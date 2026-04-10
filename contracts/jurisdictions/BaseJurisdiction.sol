// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IJurisdictionModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  BaseJurisdiction
//
//  Abstract base contract that all jurisdiction modules inherit from.
//  Provides: investor storage, KYC operator management, transfer checks,
//  pause support, and the standard IJurisdictionModule hooks.
//
//  Subclasses override:
//    - jurisdictionCode()
//    - jurisdictionName()
//    - minimumClass()
//    - _validateInvestorClass()  — country-specific tier logic
//    - _additionalTransferChecks() — country-specific transfer rules
// ─────────────────────────────────────────────────────────────────────────────

abstract contract BaseJurisdiction is IJurisdictionModule, AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant KYC_OPERATOR_ROLE = keccak256("KYC_OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE       = keccak256("PAUSER_ROLE");

    // ── State ─────────────────────────────────────────────────────────────────

    mapping(address => InvestorRecord) internal _investors;
    mapping(address => bool)           internal _revoked;

    bool public paused;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KYC_OPERATOR_ROLE,  admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ── Abstract identity (public so they can be called internally) ──────────

    function jurisdictionCode() public view virtual returns (string memory);
    function jurisdictionName() public view virtual returns (string memory);
    function minimumClass()     public view virtual returns (InvestorClass);

    // ── Pause ─────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { paused = true; }
    function unpause() external onlyRole(PAUSER_ROLE) { paused = false; }

    // ── IComplianceModule ─────────────────────────────────────────────────────

    /// @inheritdoc IComplianceModule
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view override returns (bool allowed, string memory reason) {
        if (paused) return (false, string(abi.encodePacked(jurisdictionCode(), ": paused")));

        // Check sender (mints have from == address(0), skip sender check)
        if (from != address(0)) {
            if (_revoked[from])         return (false, string(abi.encodePacked(jurisdictionCode(), ": sender revoked")));
            if (!_isActive(from))       return (false, string(abi.encodePacked(jurisdictionCode(), ": sender not registered")));
            if (!_meetsMin(from))       return (false, string(abi.encodePacked(jurisdictionCode(), ": sender class too low")));
        }

        // Check receiver
        if (_revoked[to])           return (false, string(abi.encodePacked(jurisdictionCode(), ": receiver revoked")));
        if (!_isActive(to))         return (false, string(abi.encodePacked(jurisdictionCode(), ": receiver not registered")));
        if (!_meetsMin(to))         return (false, string(abi.encodePacked(jurisdictionCode(), ": receiver class too low")));

        // Country-specific additional checks
        return _additionalTransferChecks(from, to, amount);
    }

    /// @inheritdoc IComplianceModule
    function onTransfer(address, address, uint256) external virtual override {}

    // ── IJurisdictionModule ───────────────────────────────────────────────────

    function registerInvestor(
        address         investor,
        InvestorClass   investorClass,
        uint256         expiresAt,
        bytes32         kycRef,
        bytes32[] calldata attestationUIDs
    ) external virtual override onlyRole(KYC_OPERATOR_ROLE) {
        require(investor != address(0), "Jurisdiction: zero address");
        _validateInvestorClass(investorClass);

        _investors[investor] = InvestorRecord({
            registered:    true,
            investorClass: investorClass,
            jurisdiction:  jurisdictionCode(),
            registeredAt:  block.timestamp,
            expiresAt:     expiresAt,
            kycRef:        kycRef,
            attestationUIDs: attestationUIDs
        });
        _revoked[investor] = false;

        emit InvestorRegistered(investor, investorClass, expiresAt);
    }

    function batchRegisterInvestors(
        address[]         calldata investors,
        InvestorClass[]   calldata investorClasses,
        uint256[]         calldata expiresAts,
        bytes32[]         calldata kycRefs
    ) external override onlyRole(KYC_OPERATOR_ROLE) {
        uint256 len = investors.length;
        require(
            len == investorClasses.length && len == expiresAts.length && len == kycRefs.length,
            "Jurisdiction: length mismatch"
        );
        for (uint256 i = 0; i < len; ++i) {
            _validateInvestorClass(investorClasses[i]);
            _investors[investors[i]] = InvestorRecord({
                registered:      true,
                investorClass:   investorClasses[i],
                jurisdiction:    jurisdictionCode(),
                registeredAt:    block.timestamp,
                expiresAt:       expiresAts[i],
                kycRef:          kycRefs[i],
                attestationUIDs: new bytes32[](0)
            });
            _revoked[investors[i]] = false;
            emit InvestorRegistered(investors[i], investorClasses[i], expiresAts[i]);
        }
    }

    function revokeInvestor(
        address investor,
        string calldata reason
    ) external override onlyRole(KYC_OPERATOR_ROLE) {
        _revoked[investor] = true;
        emit InvestorRevoked(investor, reason);
    }

    function getInvestorRecord(address investor)
        external view override returns (InvestorRecord memory)
    {
        return _investors[investor];
    }

    function isActiveInvestor(address investor)
        external view override returns (bool)
    {
        return _isActive(investor);
    }

    function meetsMinimumClass(address investor)
        external view override returns (bool)
    {
        return _meetsMin(investor);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _isActive(address investor) internal view returns (bool) {
        if (_revoked[investor])                       return false;
        InvestorRecord storage r = _investors[investor];
        if (!r.registered)                            return false;
        if (r.expiresAt > 0 && block.timestamp > r.expiresAt) return false;
        return true;
    }

    function _meetsMin(address investor) internal view returns (bool) {
        return uint8(_investors[investor].investorClass) >= uint8(minimumClass());
    }

    // ── Abstract hooks ────────────────────────────────────────────────────────

    /// @notice Validate that a proposed investorClass is legal for this jurisdiction
    function _validateInvestorClass(InvestorClass investorClass) internal view virtual;

    /// @notice Country-specific transfer checks beyond basic registration/class
    /// @dev    Return (true, "") to pass; (false, "reason") to block
    function _additionalTransferChecks(
        address from,
        address to,
        uint256 amount
    ) internal view virtual returns (bool allowed, string memory reason);
}
