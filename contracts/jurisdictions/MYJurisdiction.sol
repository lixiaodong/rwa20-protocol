// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  MYJurisdiction — Malaysia Securities Commission (SC) Framework
//
//  Legal basis:
//    Capital Markets and Services Act 2007 (CMSA)
//    SC Guidelines on Digital Assets (2020, revised 2023)
//    SC Guidelines on Recognized Markets (for IEO platforms)
//    SC Concept Paper on Asset-Backed Digital Securities (2022)
//
//  Asset tokenization:
//    Real estate: typically via a Real Estate Investment Trust (REIT)
//    regulated under SC's Guidelines on REITs.
//    Agriculture: direct tokenization permitted under SC Digital Assets guidelines
//    for private placement to sophisticated investors.
//    SPV must be registered with SSM (Suruhanjaya Syarikat Malaysia).
//    Property title registered with Pejabat Tanah (Land Office).
//
//  Investor tiers (CMSA Schedule 6):
//    RETAIL        — Public investor (requires full prospectus filing with SC)
//    SOPHISTICATED — Sophisticated Investor (Schedule 6, paragraph 2):
//                    • Net personal assets > RM 3 million, OR
//                    • Net joint assets with spouse > RM 3 million, OR
//                    • Gross income > RM 300,000 in preceding 12 months, OR
//                    • Joint gross income with spouse > RM 400,000
//    INSTITUTIONAL — Bank, insurance company, fund manager approved by SC
//
//  Regulatory bodies / on-chain attestation sources:
//    SSM (Suruhanjaya Syarikat Malaysia) — Corporate registry (Bizfile+)
//    Pejabat Tanah (Land Office)         — Geran (title deed) per state
//    SC Capital Markets licence          — Fund manager / IEO operator license
//    BNMLINK                             — Bank Negara licensed institutions
//
//  Transfer restrictions:
//    - Public offer without SC-approved prospectus: PROHIBITED
//    - Private placement: max 200 investors or RM 50 million per year (CMSA s.229A)
//    - Sophisticated investors only for unlisted/private digital securities
//    - 12-month lock-up for founding shareholders (SC corporate governance)
// ─────────────────────────────────────────────────────────────────────────────

contract MYJurisdiction is BaseJurisdiction {

    // ── Config ────────────────────────────────────────────────────────────────

    /// Whether this is a sophisticated-investor-only placement
    bool public sophisticatedOnly;

    /// Max investors under private placement exemption (200 per CMSA s.229A)
    uint256 public maxInvestors;
    uint256 public investorCount;

    /// Annual fundraising cap in RM (smallest unit, 18 dec USDC equivalent acceptable)
    uint256 public annualCap;       // 0 = no cap enforced on-chain
    uint256 public raisedThisYear;
    uint256 public yearStart;

    // ── Events ────────────────────────────────────────────────────────────────

    event SophisticatedOnlySet(bool sophisticatedOnly);
    event AnnualCapSet(uint256 cap);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address admin,
        bool    sophisticatedOnly_,
        uint256 maxInvestors_,
        uint256 annualCap_
    ) BaseJurisdiction(admin) {
        sophisticatedOnly = sophisticatedOnly_;
        maxInvestors      = maxInvestors_;
        annualCap         = annualCap_;
        yearStart         = block.timestamp;
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "MY"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "Malaysia SC (Capital Markets and Services Act / Digital Assets Guidelines)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        return sophisticatedOnly ? InvestorClass.SOPHISTICATED : InvestorClass.RETAIL;
    }

    // ── Config management ─────────────────────────────────────────────────────

    function setSophisticatedOnly(bool v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sophisticatedOnly = v;
        emit SophisticatedOnlySet(v);
    }

    function setAnnualCap(uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        annualCap = cap;
        emit AnnualCapSet(cap);
    }

    function resetYearlyCounters() external onlyRole(DEFAULT_ADMIN_ROLE) {
        raisedThisYear = 0;
        yearStart      = block.timestamp;
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        require(
            cls == InvestorClass.RETAIL         ||
            cls == InvestorClass.SOPHISTICATED  ||
            cls == InvestorClass.INSTITUTIONAL,
            "MY: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address,    /* from */
        address to,
        uint256     /* amount */
    ) internal view override returns (bool allowed, string memory reason) {
        // Investor count cap
        if (maxInvestors > 0 && !_investors[to].registered && investorCount >= maxInvestors) {
            return (false, "MY: private placement investor cap reached (max 200, CMSA s.229A)");
        }
        return (true, "");
    }

    // ── Override registerInvestor to track count ──────────────────────────────

    function registerInvestor(
        address         investor,
        InvestorClass   investorClass,
        uint256         expiresAt,
        bytes32         kycRef,
        bytes32[] calldata attestationUIDs
    ) external override onlyRole(KYC_OPERATOR_ROLE) {
        bool wasRegistered = _investors[investor].registered;
        _validateInvestorClass(investorClass);

        _investors[investor] = InvestorRecord({
            registered:      true,
            investorClass:   investorClass,
            jurisdiction:    "MY",
            registeredAt:    block.timestamp,
            expiresAt:       expiresAt,
            kycRef:          kycRef,
            attestationUIDs: attestationUIDs
        });
        _revoked[investor] = false;
        if (!wasRegistered) investorCount++;
        emit InvestorRegistered(investor, investorClass, expiresAt);
    }
}
