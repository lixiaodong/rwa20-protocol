// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  LIJurisdiction — Liechtenstein TVTG (Token Container Model)
//
//  Legal basis:
//    TVTG — Gesetz über Token und VT-Dienstleister (Token and TT Service Provider Act)
//    Effective 1 January 2020. World's first comprehensive token law.
//
//  Token Container Model — the key legal innovation:
//  ──────────────────────────────────────────────────
//  Under TVTG Art. 4, a token is a "container" that can hold ANY right:
//    - Property rights (Eigentumsrechte)
//    - Contractual claims
//    - Membership rights
//    - IP rights
//    - Bearer securities
//
//  This means: the TOKEN IS the legal claim. Owning the token = owning the right.
//  Transfer of token = transfer of the underlying legal right (not just evidence).
//  This is the most favorable tokenization law in the world for RWA.
//
//  TT Service Provider (TT-SP) roles (TVTG Art. 11):
//    TOKEN_ISSUER     — creates tokens and "puts rights in the container"
//    TOKEN_CUSTODIAN  — safekeeps tokens on behalf of others
//    TOKEN_DEPOSITARY — like a securities depository for tokens
//    TOKEN_EXCHANGER  — facilitates token exchange
//    TT_AGENT         — acts on behalf of TT service providers
//
//  FMA (Finanzmarktaufsicht) — Liechtenstein Financial Market Authority:
//    - Registers TT Service Providers
//    - Issues the TT register (analogous to a corporate register for token issuers)
//    - FMA registry number is the on-chain "legal anchor" for the token
//
//  EEA membership: Liechtenstein is in the EEA, meaning EU prospectus regulations
//  and MiFID II apply to public offers. Private placements (< EUR 5 million,
//  FinSA compatible): min class = SOPHISTICATED or above.
//
//  Investor tiers:
//    RETAIL        — General public (only if prospectus filed)
//    SOPHISTICATED — Experienced private investors (self-declaration)
//    QUALIFIED     — Qualified investors per Liechtenstein investment fund law
//    INSTITUTIONAL — Supervised entities (banks, insurers, fund managers)
// ─────────────────────────────────────────────────────────────────────────────

contract LIJurisdiction is BaseJurisdiction {

    // ── TVTG-specific state ───────────────────────────────────────────────────

    /// FMA TT Service Provider registration number (e.g. "TTSP-2024-001")
    string public fmaRegistrationNumber;

    /// TT register entry reference (links to Liechtenstein's public TT register)
    string public ttRegisterRef;

    /// Whether a public prospectus has been filed (allows RETAIL)
    bool public prospectusApproved;

    // ── Events ────────────────────────────────────────────────────────────────

    event FMARegistrationSet(string registrationNumber, string ttRef);
    event ProspectusApproved(bool approved);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address admin,
        string memory fmaRegistrationNumber_,
        string memory ttRegisterRef_,
        bool   prospectusApproved_
    ) BaseJurisdiction(admin) {
        fmaRegistrationNumber = fmaRegistrationNumber_;
        ttRegisterRef         = ttRegisterRef_;
        prospectusApproved    = prospectusApproved_;
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "LI"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "Liechtenstein TVTG (Token Container Model - Token and TT Service Provider Act)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        // If prospectus approved: open to retail
        // Otherwise: minimum sophisticated (private placement exemption)
        return prospectusApproved ? InvestorClass.RETAIL : InvestorClass.SOPHISTICATED;
    }

    // ── Config ────────────────────────────────────────────────────────────────

    function setFMARegistration(
        string calldata registrationNumber,
        string calldata ttRef
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        fmaRegistrationNumber = registrationNumber;
        ttRegisterRef         = ttRef;
        emit FMARegistrationSet(registrationNumber, ttRef);
    }

    function setProspectusApproved(bool approved) external onlyRole(DEFAULT_ADMIN_ROLE) {
        prospectusApproved = approved;
        emit ProspectusApproved(approved);
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        require(
            cls == InvestorClass.RETAIL         ||
            cls == InvestorClass.SOPHISTICATED  ||
            cls == InvestorClass.QUALIFIED      ||
            cls == InvestorClass.INSTITUTIONAL,
            "LI: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address, /* from */
        address, /* to */
        uint256  /* amount */
    ) internal view override returns (bool, string memory) {
        // TVTG: Token IS the right. No transfer restrictions beyond registration.
        // (The Token Container Model makes transfer of the token = transfer of the right.)
        // All checks are handled by base (registration, class, revocation).
        return (true, "");
    }
}
