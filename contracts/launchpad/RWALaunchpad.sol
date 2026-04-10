// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../core/IRWA20.sol";
import "../core/RWA20Factory.sol";
import "../core/RWA20Token.sol";
import "./BondingCurve.sol";
import "../protocol/ProtocolFeeManager.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  RWALaunchpad  —  pump.fun style one-click RWA issuance
//
//  Issuers call launch() with a LaunchConfig and receive:
//    ┌──────────────────────────────────────────────────────────┐
//    │  RWA20Token  ←──── BasicCompliance / NoCompliance        │
//    │      │                                                    │
//    │      ├──── AssetOracle      (update NAV / yield)         │
//    │      ├──── RevenueDistributor (USDC payouts)             │
//    │      └──── WRWA20           (DEX wrapper)                │
//    │                                                          │
//    │  BondingCurve  (optional, for fundraising phase)         │
//    └──────────────────────────────────────────────────────────┘
//
//  Asset Templates:
//    REAL_ESTATE  →  recommended: useCompliance=true, 3-10yr
//    AGRICULTURE  →  recommended: useCompliance=false, oracle updates per harvest
// ─────────────────────────────────────────────────────────────────────────────

contract RWALaunchpad is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutables ────────────────────────────────────────────────────────────

    RWA20Factory        public immutable factory;
    IERC20              public immutable usdc;
    ProtocolFeeManager  public           feeManager; // upgradeable reference

    // ── Config ────────────────────────────────────────────────────────────────

    uint256 public launchFee;   // Flat USDC fee per launch (legacy, 0 = free)

    // ── Launch parameters ─────────────────────────────────────────────────────

    struct LaunchConfig {
        // ── Token metadata ────────────────────────────────────────────────────
        string    name;
        string    symbol;
        AssetType assetType;
        string    assetId;          // e.g. "DURIAN-MY-FARM-001"
        LegalInfo legalInfo;

        // ── Compliance ────────────────────────────────────────────────────────
        bool      useCompliance;    // true = KYC gated, false = open trading

        // ── Supply ────────────────────────────────────────────────────────────
        uint256   initialSupply;    // Tokens minted to issuer immediately (can be 0)

        // ── Bonding curve (optional) ──────────────────────────────────────────
        uint256   fundingTarget;    // USDC target (0 = skip bonding curve)
        uint256   curveMaxTokens;   // Tokens available via curve
        uint256   bondingBasePrice; // Floor price per token (18 dec)
        uint256   bondingSlope;     // Price slope (18 dec)
    }

    // ── Launched asset record ─────────────────────────────────────────────────

    struct LaunchedAsset {
        address issuer;
        address token;
        address compliance;
        address oracle;
        address distributor;
        address wrapper;
        address bondingCurve;   // address(0) if no curve
        uint256 launchedAt;
        bool    active;
        AssetType assetType;
        string  assetId;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    LaunchedAsset[] public assets;
    mapping(address => uint256[]) public issuerAssets;  // issuer → asset indices
    mapping(address => uint256)   public tokenIndex;    // token addr → asset index

    // ── Events ────────────────────────────────────────────────────────────────

    event AssetLaunched(
        uint256   indexed assetIndex,
        address   indexed issuer,
        address   indexed token,
        address           bondingCurve,
        AssetType         assetType,
        string            assetId
    );

    event AssetDeactivated(uint256 indexed assetIndex);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address factory_,
        address usdc_,
        uint256 launchFee_,
        address feeManager_   // address(0) = no fee manager (bootstrap)
    ) Ownable(msg.sender) {
        factory    = RWA20Factory(factory_);
        usdc       = IERC20(usdc_);
        launchFee  = launchFee_;
        if (feeManager_ != address(0)) {
            feeManager = ProtocolFeeManager(feeManager_);
        }
    }

    function setFeeManager(address feeManager_) external onlyOwner {
        feeManager = ProtocolFeeManager(feeManager_);
    }

    // ── Launch ────────────────────────────────────────────────────────────────

    /// @notice Deploy a complete RWA20 token ecosystem in one transaction
    /// @param cfg  Launch configuration
    /// @return assetIndex  Index into the assets[] registry
    function launch(LaunchConfig calldata cfg)
        external
        nonReentrant
        returns (uint256 assetIndex)
    {
        // ── Collect protocol fee ─────────────────────────────────────────────
        // Legacy flat fee (bootstrap phase)
        if (launchFee > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), launchFee);
        }
        // Dynamic fee via ProtocolFeeManager (activated in Phase 2+)
        if (address(feeManager) != address(0)) {
            // NAV-based fee calculated off-chain and pre-approved by issuer;
            // for issuance we use initialSupply * basePrice as a proxy.
            // Actual NAV-based fees are charged by the fee manager per operation.
            feeManager.recordAssetIssued(address(0), msg.sender); // token TBD below
        }

        // ── Deploy token stack via factory ───────────────────────────────────
        RWA20Factory.DeployedContracts memory deployed = factory.deploy(
            RWA20Factory.DeployParams({
                name:            cfg.name,
                symbol:          cfg.symbol,
                decimals:        18,
                assetType:       cfg.assetType,
                assetId:         cfg.assetId,
                legalInfo:       cfg.legalInfo,
                initialSupply:   cfg.initialSupply,
                rewardToken:     address(usdc),
                useCompliance:   cfg.useCompliance,
                complianceAdmin: msg.sender
            }),
            msg.sender
        );

        // ── Optional: bonding curve for fundraising ──────────────────────────
        address bondingCurveAddr;
        if (cfg.fundingTarget > 0 && cfg.curveMaxTokens > 0) {
            BondingCurve curve = new BondingCurve(
                address(usdc),
                deployed.token,
                cfg.bondingBasePrice,
                cfg.bondingSlope,
                cfg.fundingTarget,
                cfg.curveMaxTokens,
                msg.sender       // curve owner = issuer
            );
            bondingCurveAddr = address(curve);

            // Grant MINTER_ROLE to the curve so it can mint tokens on buy()
            RWA20Token(deployed.token).grantRole(
                keccak256("MINTER_ROLE"),
                bondingCurveAddr
            );
        }

        // ── Register ─────────────────────────────────────────────────────────
        assetIndex = assets.length;
        assets.push(LaunchedAsset({
            issuer:       msg.sender,
            token:        deployed.token,
            compliance:   deployed.compliance,
            oracle:       deployed.oracle,
            distributor:  deployed.distributor,
            wrapper:      deployed.wrapper,
            bondingCurve: bondingCurveAddr,
            launchedAt:   block.timestamp,
            active:       true,
            assetType:    cfg.assetType,
            assetId:      cfg.assetId
        }));

        issuerAssets[msg.sender].push(assetIndex);
        tokenIndex[deployed.token] = assetIndex;

        emit AssetLaunched(
            assetIndex,
            msg.sender,
            deployed.token,
            bondingCurveAddr,
            cfg.assetType,
            cfg.assetId
        );
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function assetCount() external view returns (uint256) {
        return assets.length;
    }

    function getAsset(uint256 idx) external view returns (LaunchedAsset memory) {
        return assets[idx];
    }

    function getIssuerAssets(address issuer) external view returns (uint256[] memory) {
        return issuerAssets[issuer];
    }

    /// @notice Return all assets (for UIs — use pagination on large sets)
    function getAllAssets() external view returns (LaunchedAsset[] memory) {
        return assets;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setLaunchFee(uint256 fee) external onlyOwner {
        launchFee = fee;
    }

    function deactivateAsset(uint256 idx) external onlyOwner {
        assets[idx].active = false;
        emit AssetDeactivated(idx);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 bal = usdc.balanceOf(address(this));
        require(bal > 0, "Launchpad: no fees");
        usdc.safeTransfer(to, bal);
    }
}
