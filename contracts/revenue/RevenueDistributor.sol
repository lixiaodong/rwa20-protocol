// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  RevenueDistributor
//  Snapshot-based USDC (or any ERC-20) revenue distribution for RWA20 holders.
//
//  Flow:
//    1. Admin/oracle calls createPeriod(amount)
//       - Pulls USDC from caller
//       - Records snapshot block + total supply
//    2. Token holders call claim(periodId)
//       - Their share = their ERC20Votes balance at snapshot / total supply
//       - Receive proportional USDC
//
//  Prerequisite:
//    Token holders must be auto-delegated on first mint (handled by RWA20Token.mint)
//    so that ERC20Votes.getPastVotes() returns their balance correctly.
//
//  Gas notes:
//    • claimMultiple() batches claims across periods in a single tx
//    • previewClaimable() is a free view for UIs
// ─────────────────────────────────────────────────────────────────────────────

contract RevenueDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ── Immutables ────────────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;  // USDC or any stablecoin
    IVotes public immutable rwaToken;     // RWA20Token (implements ERC20Votes)

    // ── Revenue period ────────────────────────────────────────────────────────

    struct Period {
        uint256 snapshotBlock;  // Block at which balances were captured
        uint256 totalReward;    // Total reward tokens for this period
        uint256 totalSupply;    // RWA20 total supply at snapshot
        uint256 createdAt;      // Timestamp
        bool    active;         // Can be deactivated by admin to reclaim funds
        string  description;    // e.g. "Q1 2025 Rental Income" / "Durian Harvest 2025"
    }

    Period[] public periods;

    // periodId → holder → claimed?
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ── Events ────────────────────────────────────────────────────────────────

    event PeriodCreated(
        uint256 indexed periodId,
        uint256 snapshotBlock,
        uint256 totalReward,
        uint256 totalSupply,
        string  description
    );

    event Claimed(
        uint256 indexed periodId,
        address indexed user,
        uint256 amount
    );

    event PeriodDeactivated(uint256 indexed periodId);
    event FundsRecovered(address indexed to, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address rwaToken_, address rewardToken_, address admin) {
        rwaToken    = IVotes(rwaToken_);
        rewardToken = IERC20(rewardToken_);
        _grantRole(DEFAULT_ADMIN_ROLE,  admin);
        _grantRole(DISTRIBUTOR_ROLE,    admin);
    }

    // ── Period management ─────────────────────────────────────────────────────

    /// @notice Create a new revenue period. Caller must approve `amount` first.
    /// @param amount      Total reward token amount to distribute
    /// @param description Human-readable label (e.g. "Q1 Rental")
    function createPeriod(uint256 amount, string calldata description)
        external
        onlyRole(DISTRIBUTOR_ROLE)
    {
        require(amount > 0, "Distributor: zero amount");

        // Use previous block to guarantee snapshot finality
        uint256 snapshotBlock = block.number - 1;
        uint256 totalSupply   = IERC20(address(rwaToken)).totalSupply();
        require(totalSupply > 0, "Distributor: zero supply");

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 pid = periods.length;
        periods.push(Period({
            snapshotBlock: snapshotBlock,
            totalReward:   amount,
            totalSupply:   totalSupply,
            createdAt:     block.timestamp,
            active:        true,
            description:   description
        }));

        emit PeriodCreated(pid, snapshotBlock, amount, totalSupply, description);
    }

    // ── Claim ─────────────────────────────────────────────────────────────────

    /// @notice Claim reward for a single period
    function claim(uint256 periodId) external nonReentrant {
        uint256 reward = _computeAndMarkClaimed(periodId, msg.sender);
        rewardToken.safeTransfer(msg.sender, reward);
    }

    /// @notice Claim rewards across multiple periods in a single transaction
    function claimMultiple(uint256[] calldata periodIds) external nonReentrant {
        uint256 totalReward;
        for (uint256 i; i < periodIds.length; ++i) {
            uint256 pid = periodIds[i];
            Period storage period = periods[pid];
            if (!period.active || claimed[pid][msg.sender]) continue;

            uint256 userBalance = rwaToken.getPastVotes(msg.sender, period.snapshotBlock);
            if (userBalance == 0) continue;

            uint256 reward = (period.totalReward * userBalance) / period.totalSupply;
            if (reward == 0) continue;

            claimed[pid][msg.sender] = true;
            totalReward += reward;
            emit Claimed(pid, msg.sender, reward);
        }
        require(totalReward > 0, "Distributor: nothing to claim");
        rewardToken.safeTransfer(msg.sender, totalReward);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _computeAndMarkClaimed(uint256 periodId, address user)
        internal
        returns (uint256 reward)
    {
        Period storage period = periods[periodId];
        require(period.active,             "Distributor: period not active");
        require(!claimed[periodId][user],  "Distributor: already claimed");

        uint256 userBalance = rwaToken.getPastVotes(user, period.snapshotBlock);
        require(userBalance > 0, "Distributor: no balance at snapshot");

        reward = (period.totalReward * userBalance) / period.totalSupply;
        require(reward > 0, "Distributor: zero reward");

        claimed[periodId][user] = true;
        emit Claimed(periodId, user, reward);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function periodCount() external view returns (uint256) {
        return periods.length;
    }

    /// @notice Preview total unclaimed rewards for a user across all active periods
    function previewClaimable(address user)
        external
        view
        returns (uint256 total, uint256[] memory claimablePeriods)
    {
        uint256 count;
        for (uint256 i; i < periods.length; ++i) {
            if (periods[i].active && !claimed[i][user]) count++;
        }
        claimablePeriods = new uint256[](count);
        uint256 j;
        for (uint256 i; i < periods.length; ++i) {
            Period storage p = periods[i];
            if (!p.active || claimed[i][user]) continue;
            uint256 bal = rwaToken.getPastVotes(user, p.snapshotBlock);
            uint256 r   = bal > 0 ? (p.totalReward * bal) / p.totalSupply : 0;
            if (r > 0) {
                total += r;
                claimablePeriods[j++] = i;
            }
        }
        // Trim array to actual count
        assembly { mstore(claimablePeriods, j) }
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// @notice Deactivate a period (stops claims, allows fund recovery)
    function deactivatePeriod(uint256 periodId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        periods[periodId].active = false;
        emit PeriodDeactivated(periodId);
    }

    /// @notice Recover funds from this contract (e.g. unclaimed after period closure)
    function recoverFunds(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        rewardToken.safeTransfer(to, amount);
        emit FundsRecovered(to, amount);
    }
}
