// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  WRWA20  —  Wrapped RWA20
//  1:1 ERC-20 wrapper around a compliance-restricted RWA20 token.
//
//  Use case:
//    RWA20 tokens have compliance checks preventing free trading.
//    WRWA20 bypasses these checks, enabling:
//      • DEX liquidity (Uniswap / Curve pools)
//      • Free peer-to-peer transfers
//      • Collateral in DeFi protocols
//
//  Security:
//    The wrapper itself has NO compliance checks.
//    The underlying RWA20 still validates on wrap/unwrap at the token level.
//    Unwrapping may fail if the receiver is not KYC'd on the underlying token.
//
//  1 WRWA20 == 1 RWA20 at all times.
// ─────────────────────────────────────────────────────────────────────────────

contract WRWA20 is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying; // The restricted RWA20 token

    // ── Events ────────────────────────────────────────────────────────────────

    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address underlying_,
        string memory name_,
        string memory symbol_
    )
        ERC20(name_, symbol_)
    {
        underlying = IERC20(underlying_);
    }

    // ── Core ──────────────────────────────────────────────────────────────────

    /// @notice Deposit `amount` of RWA20 → receive equal wRWA20
    /// @dev    Caller must approve this contract on the underlying token first.
    ///         The underlying compliance module will validate the transfer FROM
    ///         msg.sender TO this contract. Both parties must be KYC'd if compliance is on.
    function wrap(uint256 amount) external nonReentrant {
        require(amount > 0, "WRWA20: zero amount");
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
    }

    /// @notice Burn `amount` of wRWA20 → receive equal RWA20
    /// @dev    The underlying compliance module will validate the transfer FROM
    ///         this contract TO msg.sender. Unwrap may revert if receiver not KYC'd.
    function unwrap(uint256 amount) external nonReentrant {
        require(amount > 0, "WRWA20: zero amount");
        _burn(msg.sender, amount);
        underlying.safeTransfer(msg.sender, amount);
        emit Unwrapped(msg.sender, amount);
    }

    // ── Decimals mirror ───────────────────────────────────────────────────────

    /// @notice Mirror the decimals of the underlying token
    function decimals() public view override returns (uint8) {
        try IERC20Metadata(address(underlying)).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
    }
}
