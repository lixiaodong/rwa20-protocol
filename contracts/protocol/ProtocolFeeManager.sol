// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  ProtocolFeeManager
//
//  Collects and routes protocol fees across all RWA20 operations.
//  Designed for an open-source → commercial progression:
//
//  Phase 1 (Open Source / Bootstrap):
//    All fees set to 0. Protocol runs at zero cost.
//    Goal: adoption, ecosystem growth, regulatory credibility.
//
//  Phase 2 (Community / Governance Launch):
//    Minimal fees activated. Revenue funds protocol development.
//    Fee parameters governed by multisig (→ DAO over time).
//
//  Phase 3 (Enterprise / Commercial):
//    Tiered fee structure. Enterprise clients get volume discounts.
//    Premium jurisdiction modules (certified, legally opined) sold separately.
//
//  ┌──────────────────────────────────────────────────────────────┐
//  │  Fee Type          │ Default │ Max    │ Collected in         │
//  ├────────────────────┼─────────┼────────┼──────────────────────┤
//  │  Issuance          │ 0 bps   │ 100bps │ USDC                 │
//  │  Bonding Curve Buy │ 0 bps   │ 100bps │ USDC                 │
//  │  Revenue Distrib.  │ 0 bps   │ 200bps │ Reward token (USDC)  │
//  │  wRWA20 Swap       │ 0 bps   │ 30bps  │ wRWA20 tokens        │
//  │  Jurisdiction Sub  │ 0       │ Free   │ Monthly flat USDC    │
//  └──────────────────────────────────────────────────────────────┘
//
//  Fee routing:
//    70% → Protocol Treasury (development, audits, grants)
//    20% → Ecosystem Fund    (liquidity mining, BD, integrations)
//    10% → Stakers / Governors (RWA20 governance token holders, future)
//
//  All fee splits are configurable by governance. Initially treasury = 100%.
// ─────────────────────────────────────────────────────────────────────────────

contract ProtocolFeeManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant FEE_SETTER_ROLE    = keccak256("FEE_SETTER_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE"); // launchpad, distributor

    // ── Fee types ─────────────────────────────────────────────────────────────

    uint256 public constant MAX_ISSUANCE_FEE_BPS     = 100;  // 1%
    uint256 public constant MAX_BONDING_FEE_BPS       = 100;  // 1%
    uint256 public constant MAX_DISTRIBUTION_FEE_BPS  = 200;  // 2%
    uint256 public constant MAX_SWAP_FEE_BPS          = 30;   // 0.3%
    uint256 public constant BPS_DENOMINATOR           = 10000;

    struct FeeConfig {
        uint256 issuanceFeeBps;       // Charged on asset creation (% of initial NAV)
        uint256 bondingFeeBps;        // Charged on bonding curve purchases
        uint256 distributionFeeBps;   // Charged on revenue distribution payouts
        uint256 swapFeeBps;           // Charged on wRWA20 wrap/unwrap (DEX trading proxy)
        bool    feeEnabled;           // Global kill switch (false during bootstrap)
    }

    FeeConfig public feeConfig;

    // ── Treasury routing ──────────────────────────────────────────────────────

    address public treasury;       // 70% → protocol development
    address public ecosystemFund;  // 20% → grants, liquidity, BD
    address public stakersVault;   // 10% → governance token stakers (future)

    uint256 public treasurySplit     = 7000; // bps out of 10000
    uint256 public ecosystemSplit    = 2000;
    uint256 public stakersSplit      = 1000;

    // ── Per-issuer fee override (enterprise tier) ─────────────────────────────

    mapping(address => uint256) public issuerIssuanceFeeBps;    // 0 = use global
    mapping(address => bool)    public issuerFeeOverrideActive;

    // ── Cumulative stats ──────────────────────────────────────────────────────

    mapping(address => uint256) public tokenFeesCollected;  // token → USDC collected
    uint256 public totalFeesCollected;
    uint256 public totalAssetsIssued;

    // ── Events ────────────────────────────────────────────────────────────────

    event FeeConfigUpdated(FeeConfig config);
    event FeeCollected(address indexed token, string feeType, uint256 amount, address paidIn);
    event FeeRouted(uint256 treasury, uint256 ecosystem, uint256 stakers);
    event TreasurySplitUpdated(uint256 treasury, uint256 ecosystem, uint256 stakers);
    event IssuerFeeOverrideSet(address indexed issuer, uint256 feeBps);
    event AssetIssued(address indexed token, address indexed issuer);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address admin_,
        address treasury_,
        address ecosystemFund_,
        address stakersVault_
    ) {
        require(treasury_      != address(0), "FeeManager: zero treasury");
        require(ecosystemFund_ != address(0), "FeeManager: zero ecosystem");
        require(stakersVault_  != address(0), "FeeManager: zero stakers");

        _grantRole(DEFAULT_ADMIN_ROLE,  admin_);
        _grantRole(FEE_SETTER_ROLE,     admin_);
        _grantRole(FEE_COLLECTOR_ROLE,  admin_);

        treasury      = treasury_;
        ecosystemFund = ecosystemFund_;
        stakersVault  = stakersVault_;

        // Bootstrap: all fees start at zero (open-source phase)
        feeConfig = FeeConfig({
            issuanceFeeBps:      0,
            bondingFeeBps:       0,
            distributionFeeBps:  0,
            swapFeeBps:          0,
            feeEnabled:          false
        });
    }

    // ── Fee configuration ─────────────────────────────────────────────────────

    function setFeeConfig(FeeConfig calldata cfg) external onlyRole(FEE_SETTER_ROLE) {
        require(cfg.issuanceFeeBps    <= MAX_ISSUANCE_FEE_BPS,    "FeeManager: issuance fee too high");
        require(cfg.bondingFeeBps     <= MAX_BONDING_FEE_BPS,     "FeeManager: bonding fee too high");
        require(cfg.distributionFeeBps<= MAX_DISTRIBUTION_FEE_BPS,"FeeManager: distribution fee too high");
        require(cfg.swapFeeBps        <= MAX_SWAP_FEE_BPS,        "FeeManager: swap fee too high");
        feeConfig = cfg;
        emit FeeConfigUpdated(cfg);
    }

    function setTreasurySplit(
        uint256 treasury_,
        uint256 ecosystem_,
        uint256 stakers_
    ) external onlyRole(FEE_SETTER_ROLE) {
        require(treasury_ + ecosystem_ + stakers_ == BPS_DENOMINATOR, "FeeManager: splits must sum to 10000");
        treasurySplit  = treasury_;
        ecosystemSplit = ecosystem_;
        stakersSplit   = stakers_;
        emit TreasurySplitUpdated(treasury_, ecosystem_, stakers_);
    }

    function setTreasuries(
        address treasury_,
        address ecosystem_,
        address stakers_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(treasury_  != address(0), "FeeManager: zero address");
        require(ecosystem_ != address(0), "FeeManager: zero address");
        require(stakers_   != address(0), "FeeManager: zero address");
        treasury      = treasury_;
        ecosystemFund = ecosystem_;
        stakersVault  = stakers_;
    }

    /// @notice Set a custom issuance fee for an enterprise issuer (volume discount)
    function setIssuerFeeOverride(
        address issuer,
        uint256 feeBps
    ) external onlyRole(FEE_SETTER_ROLE) {
        require(feeBps <= MAX_ISSUANCE_FEE_BPS, "FeeManager: fee too high");
        issuerIssuanceFeeBps[issuer]    = feeBps;
        issuerFeeOverrideActive[issuer] = true;
        emit IssuerFeeOverrideSet(issuer, feeBps);
    }

    function removeIssuerFeeOverride(address issuer) external onlyRole(FEE_SETTER_ROLE) {
        issuerFeeOverrideActive[issuer] = false;
    }

    // ── Fee calculation ───────────────────────────────────────────────────────

    /// @notice Calculate issuance fee for a given NAV (in USDC base units)
    function calcIssuanceFee(address issuer, uint256 navUSDC)
        external view returns (uint256 fee)
    {
        if (!feeConfig.feeEnabled) return 0;
        uint256 bps = issuerFeeOverrideActive[issuer]
            ? issuerIssuanceFeeBps[issuer]
            : feeConfig.issuanceFeeBps;
        return (navUSDC * bps) / BPS_DENOMINATOR;
    }

    /// @notice Calculate bonding curve purchase fee
    function calcBondingFee(uint256 cost)
        external view returns (uint256 fee)
    {
        if (!feeConfig.feeEnabled) return 0;
        return (cost * feeConfig.bondingFeeBps) / BPS_DENOMINATOR;
    }

    /// @notice Calculate revenue distribution fee
    function calcDistributionFee(uint256 amount)
        external view returns (uint256 fee)
    {
        if (!feeConfig.feeEnabled) return 0;
        return (amount * feeConfig.distributionFeeBps) / BPS_DENOMINATOR;
    }

    // ── Fee collection (called by protocol contracts) ─────────────────────────

    /// @notice Collect a fee from a protocol operation
    /// @param token       The RWA20 token this fee relates to
    /// @param feeType     Human-readable: "issuance", "bonding", "distribution", "swap"
    /// @param feeToken    ERC20 token the fee is paid in (USDC address)
    /// @param amount      Fee amount (already calculated by caller)
    function collectFee(
        address token,
        string calldata feeType,
        address feeToken,
        uint256 amount
    ) external nonReentrant onlyRole(FEE_COLLECTOR_ROLE) {
        if (amount == 0) return;
        IERC20(feeToken).safeTransferFrom(msg.sender, address(this), amount);
        tokenFeesCollected[token] += amount;
        totalFeesCollected        += amount;
        emit FeeCollected(token, feeType, amount, feeToken);
    }

    /// @notice Record asset issuance (for stats; fee is collected separately)
    function recordAssetIssued(address token, address issuer)
        external onlyRole(FEE_COLLECTOR_ROLE)
    {
        totalAssetsIssued++;
        emit AssetIssued(token, issuer);
    }

    // ── Treasury routing ──────────────────────────────────────────────────────

    /// @notice Sweep accumulated fees to treasury/ecosystem/stakers
    function sweep(address feeToken) external nonReentrant {
        uint256 balance = IERC20(feeToken).balanceOf(address(this));
        require(balance > 0, "FeeManager: nothing to sweep");

        uint256 toTreasury  = (balance * treasurySplit)  / BPS_DENOMINATOR;
        uint256 toEcosystem = (balance * ecosystemSplit) / BPS_DENOMINATOR;
        uint256 toStakers   = balance - toTreasury - toEcosystem; // remainder prevents dust

        if (toTreasury  > 0) IERC20(feeToken).safeTransfer(treasury,      toTreasury);
        if (toEcosystem > 0) IERC20(feeToken).safeTransfer(ecosystemFund,  toEcosystem);
        if (toStakers   > 0) IERC20(feeToken).safeTransfer(stakersVault,   toStakers);

        emit FeeRouted(toTreasury, toEcosystem, toStakers);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function isFeeEnabled() external view returns (bool) {
        return feeConfig.feeEnabled;
    }

    function getFeeConfig() external view returns (FeeConfig memory) {
        return feeConfig;
    }
}
