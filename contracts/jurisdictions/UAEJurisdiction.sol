// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  UAEJurisdiction — UAE ADGM / VARA / DIFC Framework
//
//  Legal basis:
//    ADGM FSRA: Financial Services and Markets Regulations (FSMR)
//      — Investment Token Rules (2021, updated 2023)
//    DIFC DFSA: Collective Investment Law (CIL) + Digital Assets Rules
//    VARA (Virtual Assets Regulatory Authority): Virtual Asset Issuance Rulebook 2023
//    CBUAE: Central Bank UAE Payment Token regulations
//
//  Two regulatory zones:
//  ─────────────────────
//  1. ADGM (Abu Dhabi Global Market)
//     • Free zone with its own common law courts (ADGM Courts)
//     • Investment Tokens = security tokens, regulated by FSRA
//     • ADGM Courts are internationally recognized — judgments enforceable globally
//     • On-chain evidence admitted in ADGM Court proceedings (Practice Direction 2022)
//
//  2. DIFC (Dubai International Financial Centre)
//     • Common law jurisdiction with DIFC Courts
//     • Digital Assets Law 2024 — tokens recognized as property
//     • DIFC Courts: "Digital Economy Court" — world's first dedicated crypto court
//     • On-chain court orders: DIFC issued world's first NFT-based court injunction (2022)
//
//  3. VARA (mainland Dubai)
//     • Real Asset Tokens (RATs) framework — property-backed tokens
//     • Issuer must hold VASP license from VARA
//
//  Investor tiers (ADGM FSMR COB Rules):
//    RETAIL        — Standard retail, strict protections
//    PROFESSIONAL  — Professional Client (PC):
//                    • Net assets > USD 1 million (excl. primary residence), OR
//                    • Income > USD 200,000 last 2 years, OR
//                    • Financial professional (CFA, CAIA, etc.)
//    INSTITUTIONAL — Regulated financial institution, government entity
//
//  Transfer restrictions:
//    - Private placement to Professional Clients only (ADGM Rule 3.7.2)
//    - Max 200 investors without public offer prospectus
//    - KYC/AML mandatory per ADGM AML/CFT Rules
//    - No transfer to Iranian or North Korean nationals (UNSC sanctions)
// ─────────────────────────────────────────────────────────────────────────────

contract UAEJurisdiction is BaseJurisdiction {

    // ── Config ────────────────────────────────────────────────────────────────

    /// Whether this is a professional-client-only offer (ADGM Rule 3.7.2)
    bool public professionalClientOnly;

    /// Maximum investor count (200 for UAE private placement without prospectus)
    uint256 public maxInvestors;
    uint256 public investorCount;

    /// Sanctioned jurisdiction codes that block transfers (ISO alpha-2)
    mapping(bytes2 => bool) public sanctionedJurisdictions;

    /// Investor nationality/residence jurisdiction
    mapping(address => bytes2) public investorNationality;

    // ── Events ────────────────────────────────────────────────────────────────

    event ProfessionalClientOnlySet(bool pcOnly);
    event SanctionedJurisdictionSet(bytes2 isoCode, bool sanctioned);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address admin,
        bool    professionalClientOnly_,
        uint256 maxInvestors_
    ) BaseJurisdiction(admin) {
        professionalClientOnly = professionalClientOnly_;
        maxInvestors           = maxInvestors_;

        // Pre-populate with UNSC primary sanction targets
        sanctionedJurisdictions[bytes2("IR")] = true; // Iran
        sanctionedJurisdictions[bytes2("KP")] = true; // North Korea
        sanctionedJurisdictions[bytes2("SY")] = true; // Syria
        sanctionedJurisdictions[bytes2("CU")] = true; // Cuba (OFAC)
        sanctionedJurisdictions[bytes2("RU")] = true; // Russia (post-2022)
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "AE"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "UAE ADGM/VARA (FSRA Investment Token Rules)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        return professionalClientOnly ? InvestorClass.PROFESSIONAL : InvestorClass.RETAIL;
    }

    // ── Config management ─────────────────────────────────────────────────────

    function setProfessionalClientOnly(bool pcOnly) external onlyRole(DEFAULT_ADMIN_ROLE) {
        professionalClientOnly = pcOnly;
        emit ProfessionalClientOnlySet(pcOnly);
    }

    function setSanctionedJurisdiction(bytes2 isoCode, bool sanctioned)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        sanctionedJurisdictions[isoCode] = sanctioned;
        emit SanctionedJurisdictionSet(isoCode, sanctioned);
    }

    function setInvestorNationality(address investor, bytes2 nationality)
        external onlyRole(KYC_OPERATOR_ROLE)
    {
        investorNationality[investor] = nationality;
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        require(
            cls == InvestorClass.RETAIL         ||
            cls == InvestorClass.PROFESSIONAL   ||
            cls == InvestorClass.INSTITUTIONAL,
            "AE: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address from,
        address to,
        uint256  /* amount */
    ) internal view override returns (bool allowed, string memory reason) {
        // Sanctions check on receiver nationality
        bytes2 nationality = investorNationality[to];
        if (nationality != bytes2(0) && sanctionedJurisdictions[nationality]) {
            return (false, "AE: receiver nationality is sanctioned (UNSC/OFAC)");
        }
        if (from != address(0)) {
            bytes2 fromNationality = investorNationality[from];
            if (fromNationality != bytes2(0) && sanctionedJurisdictions[fromNationality]) {
                return (false, "AE: sender nationality is sanctioned (UNSC/OFAC)");
            }
        }

        // Private placement cap
        if (maxInvestors > 0 && !_investors[to].registered && investorCount >= maxInvestors) {
            return (false, "AE: private placement investor cap reached (max 200, ADGM Rule 3.7)");
        }

        return (true, "");
    }

    // ── Override registerInvestor to track count and nationality ──────────────

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
            jurisdiction:    "AE",
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
