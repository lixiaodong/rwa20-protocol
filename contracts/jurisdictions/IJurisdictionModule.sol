// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../compliance/IComplianceModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  IJurisdictionModule
//
//  Extends IComplianceModule with jurisdiction-specific investor registration
//  and verification logic. Each country that wants to support RWA20 assets
//  deploys one contract implementing this interface.
//
//  Adding a new country = deploy one new IJurisdictionModule contract.
//  No changes to existing contracts required.
//
//  ┌──────────────────────────────────────────────────────────────┐
//  │  Country       │  Module              │  Key rule            │
//  ├────────────────┼──────────────────────┼──────────────────────┤
//  │  SG            │  SGJurisdiction      │  MAS AI: SGD 2M/300K │
//  │  CH            │  CHJurisdiction      │  FINMA QI: CHF 500K  │
//  │  AE            │  UAEJurisdiction     │  ADGM PC: USD 500K   │
//  │  LI            │  LIJurisdiction      │  TVTG TT-SP register │
//  │  MY            │  MYJurisdiction      │  SC SI: RM 3M/300K   │
//  │  US            │  USJurisdiction      │  SEC AI: $1M/$200K   │
//  └────────────────┴──────────────────────┴──────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Investor qualification tier — country-specific semantics in the module
enum InvestorClass {
    NONE,               // Not registered
    RETAIL,             // Retail / non-accredited investor
    SOPHISTICATED,      // Sophisticated / experienced (MY, SG non-AI)
    PROFESSIONAL,       // Professional client (UAE, EU MiFID II)
    ACCREDITED,         // Accredited investor (US, SG AI, MY SI)
    QUALIFIED,          // Qualified investor (CH, SG QI)
    INSTITUTIONAL       // Institutional investor (any jurisdiction)
}

/// @notice On-chain investor record stored by each jurisdiction module
struct InvestorRecord {
    bool        registered;
    InvestorClass investorClass;
    string      jurisdiction;       // redundant but readable: "SG", "US", etc.
    uint256     registeredAt;
    uint256     expiresAt;          // KYC expiry; 0 = no expiry
    bytes32     kycRef;             // Off-chain KYC reference hash
    bytes32[]   attestationUIDs;    // Pointers to LegalAttestationRegistry entries
}

/// @title IJurisdictionModule
/// @notice Country-specific compliance module for RWA20 tokens.
///         Drop-in replacement for IComplianceModule with richer investor mgmt.
interface IJurisdictionModule is IComplianceModule {

    // ── Events ────────────────────────────────────────────────────────────────

    event InvestorRegistered(address indexed investor, InvestorClass investorClass, uint256 expiresAt);
    event InvestorUpdated(address indexed investor, InvestorClass investorClass);
    event InvestorRevoked(address indexed investor, string reason);

    // ── Module identity ───────────────────────────────────────────────────────

    /// @notice ISO 3166-1 alpha-2 code: "SG", "CH", "AE", "LI", "MY", "US"
    function jurisdictionCode() external view returns (string memory);

    /// @notice Human-readable name: "Singapore MAS", "FINMA Switzerland", etc.
    function jurisdictionName() external view returns (string memory);

    /// @notice Minimum InvestorClass required to hold this token
    function minimumClass() external view returns (InvestorClass);

    // ── Investor management ───────────────────────────────────────────────────

    /// @notice Register or update an investor. Called by authorized KYC operator.
    function registerInvestor(
        address         investor,
        InvestorClass   investorClass,
        uint256         expiresAt,
        bytes32         kycRef,
        bytes32[] calldata attestationUIDs
    ) external;

    /// @notice Batch-register investors for gas-efficient onboarding
    function batchRegisterInvestors(
        address[]         calldata investors,
        InvestorClass[]   calldata investorClasses,
        uint256[]         calldata expiresAts,
        bytes32[]         calldata kycRefs
    ) external;

    /// @notice Revoke an investor (KYC failure, sanctions, AML)
    function revokeInvestor(address investor, string calldata reason) external;

    // ── Queries ───────────────────────────────────────────────────────────────

    /// @notice Get the full on-chain record for an investor
    function getInvestorRecord(address investor) external view returns (InvestorRecord memory);

    /// @notice Quick check: is this address an active, non-expired investor?
    function isActiveInvestor(address investor) external view returns (bool);

    /// @notice Quick check: does this address meet the minimum class requirement?
    function meetsMinimumClass(address investor) external view returns (bool);
}
