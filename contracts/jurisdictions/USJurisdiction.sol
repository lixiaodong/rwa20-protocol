// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  USJurisdiction — United States SEC Framework
//
//  Legal basis:
//    Securities Act of 1933 — all token offerings are presumed securities
//    Securities Exchange Act of 1934 — secondary market transfers
//    Regulation D — exemption from registration for private placements
//    Regulation S — offshore transactions, no US-targeted sales
//    Investment Company Act of 1940 — fund structures
//
//  Applicable exemptions for RWA20 tokens:
//  ─────────────────────────────────────────
//  REG_D_506B — Reg D Rule 506(b): up to 35 non-accredited + unlimited accredited
//               No general solicitation. Issuer must reasonably believe investors qualify.
//
//  REG_D_506C — Reg D Rule 506(c): unlimited accredited investors only.
//               General solicitation ALLOWED. Must VERIFY accredited status (not self-certify).
//               Typically via third-party letter from CPA, attorney, or FINRA broker.
//
//  REG_S     — Offshore: investors outside the US. No US directed selling efforts.
//               Restricted period: 40 days for Tier 2 (equity, most RWA tokens).
//               Transfer to US persons prohibited during restricted period.
//
//  Investor tiers (SEC Reg D Rule 501):
//    RETAIL        — Non-accredited investor (only in 506(b), max 35 per offering)
//    ACCREDITED    — Accredited Investor (Rule 501(a)):
//                    • Net worth > $1 million (excl. primary residence), OR
//                    • Individual income > $200,000 last 2 years ($300K joint), OR
//                    • Holds Series 7, 65, or 82 license
//    INSTITUTIONAL — "Qualified Institutional Buyer" (QIB, Rule 144A):
//                    institutions with > $100 million in securities
//
//  Transfer restrictions:
//    - 12-month restricted period for Reg D tokens (Rule 144 holding period)
//    - Legend requirements on certificates (informational only for on-chain)
//    - Reg S restricted period: 40 days
//    - Max 35 non-accredited investors per Reg D 506(b) offering
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Which SEC exemption this offering relies on
enum RegDType { REG_D_506B, REG_D_506C, REG_S, REGISTERED }

contract USJurisdiction is BaseJurisdiction {

    // ── Config ────────────────────────────────────────────────────────────────

    RegDType public regType;

    /// Holding period in seconds (12 months = 365 days = 31536000)
    uint256 public holdingPeriod;

    /// When the offering started (for Reg S restricted period)
    uint256 public offeringStart;

    /// 40-day Reg S restricted period in seconds
    uint256 public constant REG_S_RESTRICTED_PERIOD = 40 days;

    /// Max non-accredited investors for 506(b) (hard limit: 35)
    uint256 public maxNonAccredited;
    uint256 public nonAccreditedCount;

    /// Per-investor first acquisition timestamp (for holding period)
    mapping(address => uint256) public firstAcquisitionAt;

    /// US persons flag (for Reg S — US persons cannot receive during restricted period)
    mapping(address => bool) public isUSPerson;

    // ── Events ────────────────────────────────────────────────────────────────

    event RegTypeSet(RegDType regType);
    event HoldingPeriodSet(uint256 seconds_);
    event USPersonFlagged(address indexed investor, bool isUSPerson_);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address  admin,
        RegDType regType_,
        uint256  holdingPeriod_
    ) BaseJurisdiction(admin) {
        regType          = regType_;
        holdingPeriod    = holdingPeriod_;
        offeringStart    = block.timestamp;
        maxNonAccredited = 35; // Reg D 506(b) hard cap
    }

    // ── IJurisdictionModule identity ──────────────────────────────────────────

    function jurisdictionCode() public pure override returns (string memory) { return "US"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "United States SEC (Regulation D / Regulation S)";
    }

    function minimumClass() public view override returns (InvestorClass) {
        if (regType == RegDType.REG_D_506C) return InvestorClass.ACCREDITED;
        if (regType == RegDType.REG_S)      return InvestorClass.RETAIL;      // foreign investors
        return InvestorClass.RETAIL; // 506(b) allows up to 35 non-accredited
    }

    // ── Config management ─────────────────────────────────────────────────────

    function setRegType(RegDType rt) external onlyRole(DEFAULT_ADMIN_ROLE) {
        regType = rt;
        emit RegTypeSet(rt);
    }

    function setHoldingPeriod(uint256 secs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        holdingPeriod = secs;
        emit HoldingPeriodSet(secs);
    }

    function setUSPerson(address investor, bool flag)
        external onlyRole(KYC_OPERATOR_ROLE)
    {
        isUSPerson[investor] = flag;
        emit USPersonFlagged(investor, flag);
    }

    // ── IComplianceModule.onTransfer — record first acquisition ──────────────

    function onTransfer(address, address to, uint256) external override {
        if (firstAcquisitionAt[to] == 0) {
            firstAcquisitionAt[to] = block.timestamp;
        }
    }

    // ── BaseJurisdiction overrides ────────────────────────────────────────────

    function _validateInvestorClass(InvestorClass cls) internal pure override {
        require(
            cls == InvestorClass.RETAIL         ||
            cls == InvestorClass.ACCREDITED     ||
            cls == InvestorClass.INSTITUTIONAL,
            "US: invalid investor class"
        );
    }

    function _additionalTransferChecks(
        address from,
        address to,
        uint256  /* amount */
    ) internal view override returns (bool allowed, string memory reason) {
        // ── Reg S restricted period: no transfer to US persons ───────────────
        if (regType == RegDType.REG_S) {
            if (block.timestamp < offeringStart + REG_S_RESTRICTED_PERIOD) {
                if (isUSPerson[to]) {
                    return (false, "US: Reg S restricted period - US persons cannot receive (40-day lockup)");
                }
            }
        }

        // ── 506(b): cap on non-accredited investors ──────────────────────────
        if (regType == RegDType.REG_D_506B) {
            InvestorRecord storage toRecord = _investors[to];
            if (
                toRecord.investorClass == InvestorClass.RETAIL &&
                !toRecord.registered &&
                nonAccreditedCount >= maxNonAccredited
            ) {
                return (false, "US: Reg D 506(b) max 35 non-accredited investors reached");
            }
        }

        // ── Rule 144 holding period ───────────────────────────────────────────
        if (holdingPeriod > 0 && from != address(0) && firstAcquisitionAt[from] > 0) {
            if (block.timestamp < firstAcquisitionAt[from] + holdingPeriod) {
                return (false, "US: Reg D Rule 144 holding period not expired (12 months)");
            }
        }

        return (true, "");
    }

    // ── Override registerInvestor to track non-accredited count ──────────────

    function registerInvestor(
        address         investor,
        InvestorClass   investorClass,
        uint256         expiresAt,
        bytes32         kycRef,
        bytes32[] calldata attestationUIDs
    ) external override onlyRole(KYC_OPERATOR_ROLE) {
        bool wasRegistered  = _investors[investor].registered;
        bool wasNonAccredited = wasRegistered && _investors[investor].investorClass == InvestorClass.RETAIL;
        _validateInvestorClass(investorClass);

        _investors[investor] = InvestorRecord({
            registered:      true,
            investorClass:   investorClass,
            jurisdiction:    "US",
            registeredAt:    block.timestamp,
            expiresAt:       expiresAt,
            kycRef:          kycRef,
            attestationUIDs: attestationUIDs
        });
        _revoked[investor] = false;

        // Track non-accredited count for 506(b)
        bool isNonAccredited = investorClass == InvestorClass.RETAIL;
        if (!wasRegistered && isNonAccredited) {
            nonAccreditedCount++;
        } else if (wasNonAccredited && !isNonAccredited) {
            if (nonAccreditedCount > 0) nonAccreditedCount--;
        }

        emit InvestorRegistered(investor, investorClass, expiresAt);
    }
}
