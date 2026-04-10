// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IComplianceModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  BasicCompliance
//  Full-featured compliance module with:
//    • KYC whitelist (must be explicitly approved)
//    • Investor tier gating (RETAIL < ACCREDITED)
//    • Jurisdiction allow-list (ISO 3166-1 alpha-2 codes)
//    • Per-investor transfer limits (0 = unlimited)
//    • Global emergency pause
//    • Batch operations for gas efficiency
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Investor classification
enum InvestorTier {
    NONE,        // 0 — not onboarded
    RETAIL,      // 1 — KYC'd retail investor
    ACCREDITED   // 2 — accredited / institutional investor
}

contract BasicCompliance is IComplianceModule, AccessControl {
    bytes32 public constant COMPLIANCE_ADMIN = keccak256("COMPLIANCE_ADMIN");

    // ── Investor record ───────────────────────────────────────────────────────

    struct InvestorInfo {
        bool         approved;       // KYC approved
        InvestorTier tier;           // Classification
        string       jurisdiction;   // ISO country code
        uint256      transferLimit;  // Max per-tx amount (0 = unlimited)
    }

    // ── State ─────────────────────────────────────────────────────────────────

    mapping(address => InvestorInfo) public investors;
    mapping(string  => bool)         public allowedJurisdictions;

    InvestorTier public minTier;  // Global minimum tier for all transfers
    bool         public paused;   // Emergency pause

    // ── Events ────────────────────────────────────────────────────────────────

    event InvestorRegistered(
        address      indexed account,
        InvestorTier         tier,
        string               jurisdiction
    );
    event JurisdictionUpdated(string indexed code, bool allowed);
    event MinTierUpdated(InvestorTier minTier);
    event CompliancePaused(bool paused);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ADMIN,   admin);
        minTier = InvestorTier.RETAIL; // default: require at least RETAIL
    }

    // ── Admin: investor management ────────────────────────────────────────────

    /// @notice Register or update a single investor
    function setInvestor(
        address      account,
        bool         approved,
        InvestorTier tier,
        string calldata jurisdiction,
        uint256      transferLimit
    ) external onlyRole(COMPLIANCE_ADMIN) {
        investors[account] = InvestorInfo(approved, tier, jurisdiction, transferLimit);
        emit AddressStatusUpdated(account, approved);
        emit InvestorRegistered(account, tier, jurisdiction);
    }

    /// @notice Batch-register investors (gas-efficient onboarding)
    function batchSetInvestors(
        address[]      calldata accounts,
        bool[]         calldata approved,
        InvestorTier[] calldata tiers,
        string[]       calldata jurisdictions,
        uint256[]      calldata limits
    ) external onlyRole(COMPLIANCE_ADMIN) {
        uint256 len = accounts.length;
        require(
            len == approved.length &&
            len == tiers.length &&
            len == jurisdictions.length &&
            len == limits.length,
            "Compliance: length mismatch"
        );
        for (uint256 i; i < len; ++i) {
            investors[accounts[i]] = InvestorInfo(
                approved[i], tiers[i], jurisdictions[i], limits[i]
            );
            emit AddressStatusUpdated(accounts[i], approved[i]);
            emit InvestorRegistered(accounts[i], tiers[i], jurisdictions[i]);
        }
    }

    /// @notice Revoke KYC status (blocks transfers immediately)
    function revokeInvestor(address account) external onlyRole(COMPLIANCE_ADMIN) {
        investors[account].approved = false;
        emit AddressStatusUpdated(account, false);
    }

    // ── Admin: jurisdiction ───────────────────────────────────────────────────

    /// @notice Allow or block transfers involving a jurisdiction code
    function setJurisdiction(string calldata code, bool allowed)
        external
        onlyRole(COMPLIANCE_ADMIN)
    {
        allowedJurisdictions[code] = allowed;
        emit JurisdictionUpdated(code, allowed);
    }

    /// @notice Batch-update jurisdictions
    function batchSetJurisdictions(
        string[] calldata codes,
        bool[]   calldata allowed
    ) external onlyRole(COMPLIANCE_ADMIN) {
        require(codes.length == allowed.length, "Compliance: length mismatch");
        for (uint256 i; i < codes.length; ++i) {
            allowedJurisdictions[codes[i]] = allowed[i];
            emit JurisdictionUpdated(codes[i], allowed[i]);
        }
    }

    // ── Admin: global settings ────────────────────────────────────────────────

    function setMinTier(InvestorTier tier) external onlyRole(COMPLIANCE_ADMIN) {
        minTier = tier;
        emit MinTierUpdated(tier);
    }

    function setPaused(bool _paused) external onlyRole(COMPLIANCE_ADMIN) {
        paused = _paused;
        emit CompliancePaused(_paused);
    }

    // ── IComplianceModule ─────────────────────────────────────────────────────

    function canTransfer(address from, address to, uint256 amount)
        external
        view
        override
        returns (bool, string memory)
    {
        // Emergency pause
        if (paused) return (false, "Compliance: paused");

        // Mints (from == address(0)) always pass
        if (from == address(0)) return (true, "");

        InvestorInfo storage sender   = investors[from];
        InvestorInfo storage receiver = investors[to];

        // KYC checks
        if (!sender.approved)
            return (false, "Compliance: sender not KYC approved");
        if (!receiver.approved)
            return (false, "Compliance: receiver not KYC approved");

        // Tier checks
        if (uint8(sender.tier) < uint8(minTier))
            return (false, "Compliance: sender tier insufficient");
        if (uint8(receiver.tier) < uint8(minTier))
            return (false, "Compliance: receiver tier insufficient");

        // Jurisdiction checks (only if jurisdiction is set)
        if (bytes(sender.jurisdiction).length > 0) {
            if (!allowedJurisdictions[sender.jurisdiction])
                return (false, "Compliance: sender jurisdiction not allowed");
        }
        if (bytes(receiver.jurisdiction).length > 0) {
            if (!allowedJurisdictions[receiver.jurisdiction])
                return (false, "Compliance: receiver jurisdiction not allowed");
        }

        // Per-investor transfer limit
        if (sender.transferLimit > 0 && amount > sender.transferLimit)
            return (false, "Compliance: sender transfer limit exceeded");

        return (true, "");
    }

    /// @dev No stateful side-effects needed in this implementation
    function onTransfer(address, address, uint256) external override {}

    // ── View helpers ──────────────────────────────────────────────────────────

    function getInvestorInfo(address account)
        external
        view
        returns (InvestorInfo memory)
    {
        return investors[account];
    }

    function isApproved(address account) external view returns (bool) {
        return investors[account].approved;
    }
}
