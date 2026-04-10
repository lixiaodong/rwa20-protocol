// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  CHJurisdiction — Switzerland FINMA / DLT Act Framework
//
//  Legal basis:
//    Federal Act on Financial Market Infrastructures (FMIA) — DLT Amendment 2021
//    FinSA (Financial Services Act) — investor classification
//    FinIA (Financial Institutions Act) — fund manager licensing
//    Swiss Code of Obligations Art. 973d-973i: Registerwertrechte (ledger-based
//    securities) — tokens CAN be enforceable property rights under Swiss law
//
//  Key innovation — Registerwertrecht (Ledger-Based Security):
//    Under Art. 973d CO, a token IS the legal security if:
//    1. Issued by means of an inscription on a DLT register
//    2. The register entry is authoritative (token = security, not just a certificate)
//    This is the Swiss equivalent of Liechtenstein's Token Container Model.
//
//  Asset structure:
//    Real estate: typically via collective investment scheme (KAG/CISA) or
//    Anlagestiftung (investment foundation).
//    The SPV issues Registerwertrechte tokens referencing the Handelsregister
//    (commercial register) entry and Grundbuch (land registry) folio.
//
//  Investor tiers (FinSA Art. 4-5):
//    RETAIL        — Standard retail investor, maximum protections
//    SOPHISTICATED — "Opting out" retail: written declaration of financial expertise
//    QUALIFIED     — Qualified Investor (QI):
//                    • Professional clients (banks, insurance, fund managers)
//                    • High-net-worth (CHF 500K financial assets + expertise declaration)
//    INSTITUTIONAL — Supervised financial intermediaries (FINMA licensed)
//
//  Regulatory bodies / on-chain attestation sources:
//    Handelsregister (zefix.ch)  — Federal commercial register (SPV incorporation)
//    Grundbuch                   — Cantonal land registry (property title)
//    FINMA licensing             — Collective investment scheme manager license
//
//  Transfer restrictions:
//    - Qualified Investor placement (FinSA Art. 36): min class = QUALIFIED
//    - No public offer without FINMA-approved prospectus
//    - Holding period: typically 12 months for private placements
// ─────────────────────────────────────────────────────────────────────────────

contract CHJurisdiction is BaseJurisdiction {

    // ── Config ────────────────────────────────────────────────────────────────

    /// Whether this is a QI-only placement (FinSA Art. 36 private placement)
    bool public qualifiedInvestorOnly;

    /// Lock-up period in seconds from registration (0 = no lock-up)
    uint256 public lockupPeriod;

    /// Per-investor transfer timestamps (for lock-up enforcement)
    mapping(address => uint256) public firstPurchaseAt;

    // ── Events ────────────────────────────────────────────────────────────────

    event QIOnlySet(bool qiOnly);
    event LockupPeriodSet(uint256 seconds_);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address admin,
        bool    qualifiedInvestorOnly_,
        uint256 lockupPeriod_
    ) BaseJurisdiction(admin) {
        qualifiedInvestorOnly = qualifiedInvestorOnly_;
        lockupPeriod          = lockupPeriod_;
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "CH"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "Switzerland FINMA (FinSA/DLT Act - Registerwertrechte)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        return qualifiedInvestorOnly ? InvestorClass.QUALIFIED : InvestorClass.RETAIL;
    }

    // ── Config management ─────────────────────────────────────────────────────

    function setQualifiedInvestorOnly(bool qiOnly) external onlyRole(DEFAULT_ADMIN_ROLE) {
        qualifiedInvestorOnly = qiOnly;
        emit QIOnlySet(qiOnly);
    }

    function setLockupPeriod(uint256 secs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockupPeriod = secs;
        emit LockupPeriodSet(secs);
    }

    // ── IComplianceModule.onTransfer — record first purchase ─────────────────

    function onTransfer(address, address to, uint256) external override {
        if (lockupPeriod > 0 && firstPurchaseAt[to] == 0) {
            firstPurchaseAt[to] = block.timestamp;
        }
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        require(
            cls == InvestorClass.RETAIL         ||
            cls == InvestorClass.SOPHISTICATED  ||
            cls == InvestorClass.QUALIFIED      ||
            cls == InvestorClass.INSTITUTIONAL,
            "CH: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address from,
        address,    /* to */
        uint256     /* amount */
    ) internal view override returns (bool allowed, string memory reason) {
        // Enforce lock-up: sender must have held for lockupPeriod
        if (lockupPeriod > 0 && from != address(0) && firstPurchaseAt[from] > 0) {
            if (block.timestamp < firstPurchaseAt[from] + lockupPeriod) {
                return (false, "CH: lock-up period not expired (FinSA private placement)");
            }
        }
        return (true, "");
    }
}
