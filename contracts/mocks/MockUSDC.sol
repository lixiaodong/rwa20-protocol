// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  MockUSDC  —  Test / dev stablecoin
//  6 decimals to match production USDC.
//  Includes a public faucet for easy test setup.
// ─────────────────────────────────────────────────────────────────────────────

contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6; // 10,000 USDC

    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        _mint(msg.sender, 100_000_000 * 10 ** DECIMALS); // 100M USDC to deployer
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Free 10,000 USDC for testing
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Admin mint for test setup
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
