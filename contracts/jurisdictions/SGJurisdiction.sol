// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  SGJurisdiction — Singapore MAS Framework
//
//  Legal basis:
//    Securities and Futures Act (SFA) Cap 289
//    Variable Capital Companies Act 2018 (VCC)
//    MAS Payment Services Act 2019 (PSA)
//    MAS Notice CMG-N02: Digital Payment Token Services
//
//  Asset tokenization structure:
//    Assets must be held in an SPV or VCC structure regulated under SFA.
//    Real estate: typically via a real estate investment trust (REIT) or
//    private fund vehicle (VCC).
//
//  Investor tiers (SFA Schedule 1):
//    RETAIL        — No threshold, maximum protections apply
//    ACCREDITED    — Accredited Investor (AI):
//                    • Net personal assets > SGD 2 million, OR
//                    • Income in preceding 12 months > SGD 300,000, OR
//                    • Financial assets (net) > SGD 1 million
//    INSTITUTIONAL — Bank, insurer, fund manager, govt entity
//
//  Regulatory bodies / on-chain attestation sources:
//    ACRA (Bizfile)     — Corporate registry, SPV/VCC incorporation
//    SLA (e-Lodgment)   — Singapore Land Authority, property title
//    MAS licensing      — Fund manager / REIT manager license
//    SingPass MyInfo    — National digital identity (KYC attestation)
//
//  Transfer restrictions:
//    - Retail investors may NOT receive restricted tokens unless a prospectus
//      is registered with MAS (Section 240 SFA).
//    - For exempt offers (Section 274/275 SFA), minimum class = ACCREDITED.
//    - Max 50 investors in a private placement (Section 272A).
// ─────────────────────────────────────────────────────────────────────────────

contract SGJurisdiction is BaseJurisdiction {

    // ── Config ────────────────────────────────────────────────────────────────

    /// Maximum number of investors in a Section 272A private placement
    uint256 public maxPrivatePlacementInvestors;

    /// Current registered investor count (for placement cap tracking)
    uint256 public registeredCount;

    /// Whether this token is exempt (Section 274/275) — if true, min = ACCREDITED
    bool public isExemptOffer;

    // ── Events ────────────────────────────────────────────────────────────────

    event ExemptOfferStatusSet(bool isExempt);
    event MaxInvestorsSet(uint256 max);

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param admin            Protocol admin
    /// @param exemptOffer_     True if issuing under Section 274/275 exemption
    /// @param maxInvestors_    Max investors (50 for typical private placement; 0 = unlimited)
    constructor(
        address admin,
        bool    exemptOffer_,
        uint256 maxInvestors_
    ) BaseJurisdiction(admin) {
        isExemptOffer                 = exemptOffer_;
        maxPrivatePlacementInvestors  = maxInvestors_;
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "SG"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "Singapore MAS (Securities and Futures Act)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        return isExemptOffer ? InvestorClass.ACCREDITED : InvestorClass.RETAIL;
    }

    // ── Config management ─────────────────────────────────────────────────────

    function setExemptOffer(bool exempt) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isExemptOffer = exempt;
        emit ExemptOfferStatusSet(exempt);
    }

    function setMaxInvestors(uint256 max) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPrivatePlacementInvestors = max;
        emit MaxInvestorsSet(max);
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        // SG only allows RETAIL, ACCREDITED, INSTITUTIONAL
        require(
            cls == InvestorClass.RETAIL      ||
            cls == InvestorClass.ACCREDITED  ||
            cls == InvestorClass.INSTITUTIONAL,
            "SG: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address, /* from */
        address to,
        uint256  /* amount */
    ) internal view override returns (bool allowed, string memory reason) {
        // Private placement cap: check new receiver won't breach the 50-investor cap
        if (maxPrivatePlacementInvestors > 0) {
            if (!_investors[to].registered && registeredCount >= maxPrivatePlacementInvestors) {
                return (false, "SG: private placement cap reached (max 50 investors, s.272A SFA)");
            }
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
            jurisdiction:    "SG",
            registeredAt:    block.timestamp,
            expiresAt:       expiresAt,
            kycRef:          kycRef,
            attestationUIDs: attestationUIDs
        });
        _revoked[investor] = false;

        if (!wasRegistered) registeredCount++;
        emit InvestorRegistered(investor, investorClass, expiresAt);
    }
}
