// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../compliance/IComplianceModule.sol";
import "./IJurisdictionModule.sol";
import "./JurisdictionRegistry.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  MultiJurisdictionCompliance
//
//  Drop-in IComplianceModule that enables a single RWA20 token to serve
//  investors from multiple countries simultaneously.
//
//  Logic: OR over configured jurisdictions
//  ─────────────────────────────────────────
//  A transfer is allowed if the SENDER and RECEIVER BOTH qualify under
//  at least ONE enabled jurisdiction module.
//
//  Example:
//    Token is enabled for SG + MY + AE.
//    Alice is a MY sophisticated investor.
//    Bob   is a SG accredited investor.
//    Transfer Alice → Bob: MY passes for Alice, SG passes for Bob. ALLOWED.
//
//  Why OR and not AND?
//    Real investors hold a single nationality/KYC registration. Requiring ALL
//    jurisdictions to approve would mean every investor needs KYC in every
//    country — defeating the purpose of multi-jurisdiction support.
//
//  Sender exception (mints):
//    When from == address(0) (mint), only the receiver is checked.
//
//  Global pause:
//    This contract has its own pause that blocks ALL transfers regardless
//    of jurisdiction module state (emergency stop).
//
//  Adding a new jurisdiction:
//    1. Deploy new XYJurisdiction.sol
//    2. Call registry.registerJurisdiction("XY", address(xyModule))
//    3. Call this.enableJurisdiction("XY")
//    Done — no other changes required.
// ─────────────────────────────────────────────────────────────────────────────

contract MultiJurisdictionCompliance is IComplianceModule, AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant JURISDICTION_MANAGER = keccak256("JURISDICTION_MANAGER");

    // ── State ─────────────────────────────────────────────────────────────────

    JurisdictionRegistry public immutable registry;

    /// Jurisdictions enabled for this particular token (subset of registry)
    mapping(string => bool) public enabledJurisdictions;

    /// Ordered list of enabled codes for iteration
    string[] private _enabledCodes;
    mapping(string => bool) private _inEnabledList;

    bool public globalPaused;

    // ── Events ────────────────────────────────────────────────────────────────

    event JurisdictionEnabled(string indexed code);
    event JurisdictionDisabled(string indexed code);
    event GlobalPauseSet(bool paused);

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param registryAddress   Deployed JurisdictionRegistry
    /// @param admin             Admin of this compliance module
    /// @param initialJuris      Initial jurisdiction codes to enable (e.g. ["SG","MY"])
    constructor(
        address          registryAddress,
        address          admin,
        string[] memory  initialJuris
    ) {
        registry = JurisdictionRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE,     admin);
        _grantRole(JURISDICTION_MANAGER,   admin);

        for (uint256 i = 0; i < initialJuris.length; ++i) {
            _enable(initialJuris[i]);
        }
    }

    // ── Jurisdiction management ───────────────────────────────────────────────

    function enableJurisdiction(string calldata code)
        external onlyRole(JURISDICTION_MANAGER)
    {
        require(registry.isRegistered(code), "MultiJuris: not in registry");
        _enable(code);
    }

    function disableJurisdiction(string calldata code)
        external onlyRole(JURISDICTION_MANAGER)
    {
        enabledJurisdictions[code] = false;
        emit JurisdictionDisabled(code);
    }

    function setGlobalPause(bool p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalPaused = p;
        emit GlobalPauseSet(p);
    }

    // ── IComplianceModule ─────────────────────────────────────────────────────

    /// @inheritdoc IComplianceModule
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view override returns (bool allowed, string memory reason) {
        if (globalPaused) return (false, "MultiJuris: globally paused");

        uint256 len = _enabledCodes.length;
        if (len == 0) return (false, "MultiJuris: no jurisdictions enabled");

        // Find at least one jurisdiction where the SENDER qualifies
        bool senderOk = (from == address(0)); // mints skip sender check
        string memory senderRejectReason;

        if (!senderOk) {
            for (uint256 i = 0; i < len; ++i) {
                string memory code = _enabledCodes[i];
                if (!enabledJurisdictions[code]) continue;
                address module = registry.getModule(code);
                if (module == address(0)) continue;
                (bool ok, string memory r) = IComplianceModule(module).canTransfer(from, to, amount);
                if (ok) { senderOk = true; break; }
                senderRejectReason = r; // keep last reason
            }
        }
        if (!senderOk) return (false, string(abi.encodePacked("MultiJuris sender: ", senderRejectReason)));

        // Find at least one jurisdiction where the RECEIVER qualifies
        for (uint256 i = 0; i < len; ++i) {
            string memory code = _enabledCodes[i];
            if (!enabledJurisdictions[code]) continue;
            address module = registry.getModule(code);
            if (module == address(0)) continue;
            // Check receiver only: simulate a mint-style call (from = address(0))
            (bool ok,) = IComplianceModule(module).canTransfer(address(0), to, amount);
            if (ok) return (true, "");
        }

        return (false, "MultiJuris: receiver not qualified in any enabled jurisdiction");
    }

    /// @inheritdoc IComplianceModule
    function onTransfer(address from, address to, uint256 amount) external override {
        // Propagate to all enabled modules so per-jurisdiction state (e.g. lock-up timestamps) updates
        uint256 len = _enabledCodes.length;
        for (uint256 i = 0; i < len; ++i) {
            string memory code = _enabledCodes[i];
            if (!enabledJurisdictions[code]) continue;
            address module = registry.getModule(code);
            if (module != address(0)) {
                IComplianceModule(module).onTransfer(from, to, amount);
            }
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /// @notice List all currently-enabled jurisdiction codes
    function enabledCodes() external view returns (string[] memory active) {
        uint256 count;
        for (uint256 i = 0; i < _enabledCodes.length; ++i) {
            if (enabledJurisdictions[_enabledCodes[i]]) count++;
        }
        active = new string[](count);
        uint256 j;
        for (uint256 i = 0; i < _enabledCodes.length; ++i) {
            if (enabledJurisdictions[_enabledCodes[i]]) active[j++] = _enabledCodes[i];
        }
    }

    /// @notice Check which jurisdictions approve a specific investor as receiver
    function investorQualifiedIn(address investor)
        external view returns (string[] memory qualifiedCodes)
    {
        uint256 len = _enabledCodes.length;
        string[] memory temp = new string[](len);
        uint256 count;
        for (uint256 i = 0; i < len; ++i) {
            string memory code = _enabledCodes[i];
            if (!enabledJurisdictions[code]) continue;
            address module = registry.getModule(code);
            if (module == address(0)) continue;
            (bool ok,) = IComplianceModule(module).canTransfer(address(0), investor, 0);
            if (ok) temp[count++] = code;
        }
        qualifiedCodes = new string[](count);
        for (uint256 i = 0; i < count; ++i) qualifiedCodes[i] = temp[i];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _enable(string memory code) internal {
        enabledJurisdictions[code] = true;
        if (!_inEnabledList[code]) {
            _enabledCodes.push(code);
            _inEnabledList[code] = true;
        }
        emit JurisdictionEnabled(code);
    }
}
