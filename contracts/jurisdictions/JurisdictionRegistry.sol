// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IJurisdictionModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  JurisdictionRegistry
//
//  Maps ISO 3166-1 country codes to their deployed IJurisdictionModule.
//  This is the single extension point for adding new countries to the RWA20
//  protocol — no other contracts need to change.
//
//  Extension pattern:
//  ──────────────────
//  1. Deploy a new XYJurisdiction.sol (implements IJurisdictionModule)
//  2. Call registry.registerJurisdiction("XY", address(newModule))
//  3. Done — MultiJurisdictionCompliance automatically discovers it
//
//  Protocol governance:
//  ────────────────────
//  DEFAULT_ADMIN_ROLE → can register/remove jurisdiction modules
//  REGISTRAR_ROLE     → can register new jurisdictions (less privileged)
// ─────────────────────────────────────────────────────────────────────────────

contract JurisdictionRegistry is AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // ── Storage ───────────────────────────────────────────────────────────────

    /// ISO code (uppercase, e.g. "SG") → module address
    mapping(string => address) private _modules;

    /// ordered list of all registered codes
    string[] private _codes;

    /// code → registered (to track the index)
    mapping(string => bool) private _registered;

    // ── Events ────────────────────────────────────────────────────────────────

    event JurisdictionRegistered(string indexed code, address module, string name);
    event JurisdictionUpdated(string indexed code, address oldModule, address newModule);
    event JurisdictionRemoved(string indexed code);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE,     admin);
    }

    // ── Management ────────────────────────────────────────────────────────────

    /// @notice Register a new jurisdiction module
    /// @param code   ISO 3166-1 alpha-2, uppercase: "SG", "CH", "AE", "LI", "MY", "US"
    /// @param module Address of the deployed IJurisdictionModule
    function registerJurisdiction(
        string  calldata code,
        address          module
    ) external onlyRole(REGISTRAR_ROLE) {
        require(bytes(code).length == 2, "Registry: code must be 2 chars");
        require(module != address(0),    "Registry: zero address");

        if (_registered[code]) {
            address old = _modules[code];
            _modules[code] = module;
            emit JurisdictionUpdated(code, old, module);
        } else {
            _modules[code] = module;
            _codes.push(code);
            _registered[code] = true;
            emit JurisdictionRegistered(code, module, IJurisdictionModule(module).jurisdictionName());
        }
    }

    /// @notice Deregister a jurisdiction (emergency / sunset)
    function removeJurisdiction(string calldata code)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_registered[code], "Registry: not registered");
        delete _modules[code];
        _registered[code] = false;
        // Note: we leave the code in _codes[] with a zero-address module
        // to preserve index integrity; callers should check _registered[]
        emit JurisdictionRemoved(code);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /// @notice Get the module address for a jurisdiction code
    function getModule(string calldata code) external view returns (address) {
        return _modules[code];
    }

    /// @notice Check if a jurisdiction is registered
    function isRegistered(string calldata code) external view returns (bool) {
        return _registered[code];
    }

    /// @notice List all active jurisdiction codes
    function allCodes() external view returns (string[] memory active) {
        uint256 count;
        for (uint256 i = 0; i < _codes.length; ++i) {
            if (_registered[_codes[i]]) count++;
        }
        active = new string[](count);
        uint256 j;
        for (uint256 i = 0; i < _codes.length; ++i) {
            if (_registered[_codes[i]]) active[j++] = _codes[i];
        }
    }

    /// @notice List all active jurisdiction modules with their codes
    function allModules()
        external view
        returns (string[] memory codes, address[] memory modules)
    {
        uint256 count;
        for (uint256 i = 0; i < _codes.length; ++i) {
            if (_registered[_codes[i]]) count++;
        }
        codes   = new string[](count);
        modules = new address[](count);
        uint256 j;
        for (uint256 i = 0; i < _codes.length; ++i) {
            if (_registered[_codes[i]]) {
                codes[j]   = _codes[i];
                modules[j] = _modules[_codes[i]];
                j++;
            }
        }
    }
}
