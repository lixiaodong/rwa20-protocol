// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  AssetOracle
//  Role-restricted oracle for real-world asset data:
//    • Net Asset Value (NAV) in USD
//    • Annual yield in basis points
//    • Yield period timestamps
//    • Yield metadata (IPFS CID pointing to rent roll / crop report)
//
//  For agriculture assets (e.g. durian farms):
//    → Update before each harvest season with crop yield estimate
//    → Update after harvest with actual output
//  For real estate:
//    → Update monthly / quarterly with rental income data
// ─────────────────────────────────────────────────────────────────────────────

contract AssetOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ── Data struct ───────────────────────────────────────────────────────────

    struct AssetData {
        uint256 navUSD;           // Net asset value in USD (18 decimals, e.g. 1_000_000e18 = $1M)
        uint256 annualYieldBps;   // Yield in basis points (e.g. 800 = 8.00%)
        uint256 yieldPeriodStart; // Unix timestamp: start of current yield period
        uint256 yieldPeriodEnd;   // Unix timestamp: end of current yield period
        string  yieldMetadata;    // IPFS CID of detailed yield report (PDF / JSON)
        uint256 updatedAt;        // Timestamp of last update
        address updatedBy;        // Address that last updated
    }

    // ── State ─────────────────────────────────────────────────────────────────

    AssetData public data;

    /// @notice Immutable identifier of the asset this oracle serves
    string public assetId;

    // ── Events ────────────────────────────────────────────────────────────────

    event DataUpdated(
        uint256 indexed navUSD,
        uint256 indexed annualYieldBps,
        uint256 yieldPeriodStart,
        uint256 yieldPeriodEnd,
        string  yieldMetadata,
        uint256 updatedAt,
        address indexed updatedBy
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        admin);
    }

    // ── Oracle write ──────────────────────────────────────────────────────────

    /// @notice Update the full asset data set. Only ORACLE_ROLE.
    function updateData(
        uint256 navUSD,
        uint256 annualYieldBps,
        uint256 yieldPeriodStart,
        uint256 yieldPeriodEnd,
        string calldata yieldMetadata
    ) external onlyRole(ORACLE_ROLE) {
        require(navUSD > 0,                      "Oracle: zero NAV");
        require(yieldPeriodEnd > yieldPeriodStart, "Oracle: invalid period");

        data = AssetData({
            navUSD:           navUSD,
            annualYieldBps:   annualYieldBps,
            yieldPeriodStart: yieldPeriodStart,
            yieldPeriodEnd:   yieldPeriodEnd,
            yieldMetadata:    yieldMetadata,
            updatedAt:        block.timestamp,
            updatedBy:        msg.sender
        });

        emit DataUpdated(
            navUSD,
            annualYieldBps,
            yieldPeriodStart,
            yieldPeriodEnd,
            yieldMetadata,
            block.timestamp,
            msg.sender
        );
    }

    /// @notice Lightweight NAV-only update (for frequent price feeds)
    function updateNAV(uint256 navUSD) external onlyRole(ORACLE_ROLE) {
        require(navUSD > 0, "Oracle: zero NAV");
        data.navUSD    = navUSD;
        data.updatedAt = block.timestamp;
        data.updatedBy = msg.sender;
        emit DataUpdated(
            navUSD,
            data.annualYieldBps,
            data.yieldPeriodStart,
            data.yieldPeriodEnd,
            data.yieldMetadata,
            block.timestamp,
            msg.sender
        );
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function getNAV()       external view returns (uint256) { return data.navUSD; }
    function getYieldBps()  external view returns (uint256) { return data.annualYieldBps; }
    function getMetadata()  external view returns (string memory) { return data.yieldMetadata; }
    function isStale(uint256 maxAge) external view returns (bool) {
        return block.timestamp - data.updatedAt > maxAge;
    }
}
