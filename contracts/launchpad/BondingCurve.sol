// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  BondingCurve
//  Linear bonding curve pricing for RWA20 token sales.
//
//  Price model:
//    price(supply) = basePrice + (slope × supply) / 1e18
//
//  Total cost to buy `n` tokens starting at supply `s`:
//    cost = n × basePrice + slope × (2s + n) × n / (2 × 1e18)
//
//  Example (Real Estate token):
//    basePrice = 100e18  ($100 per token)
//    slope     = 1e16    (price rises $0.01 per token sold)
//    At 10,000 tokens sold: price = $200
//
//  Funding lifecycle:
//    OPEN      → tokens available for purchase
//    FUNDED    → funding target reached, owner can withdraw
//    CLOSED    → manually closed by owner
// ─────────────────────────────────────────────────────────────────────────────

contract BondingCurve is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────────────

    IERC20  public immutable paymentToken;   // USDC
    address public immutable rwaToken;       // RWA20Token to mint

    uint256 public immutable basePrice;      // Floor price per token (18 dec)
    uint256 public immutable slope;          // Price increase per token sold (18 dec)
    uint256 public immutable fundingTarget;  // USDC target (18 dec)
    uint256 public immutable maxTokens;      // Total tokens available for sale (18 dec)

    uint256 public tokensSold;
    uint256 public fundsRaised;

    enum Status { OPEN, FUNDED, CLOSED }
    Status public status;

    // ── Events ────────────────────────────────────────────────────────────────

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 usdcCost);
    event FundingTargetReached(uint256 totalRaised);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event CurveClosed();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address paymentToken_,
        address rwaToken_,
        uint256 basePrice_,
        uint256 slope_,
        uint256 fundingTarget_,
        uint256 maxTokens_,
        address owner_
    ) Ownable(owner_) {
        require(basePrice_     > 0, "Curve: zero base price");
        require(fundingTarget_ > 0, "Curve: zero target");
        require(maxTokens_     > 0, "Curve: zero max tokens");

        paymentToken  = IERC20(paymentToken_);
        rwaToken      = rwaToken_;
        basePrice     = basePrice_;
        slope         = slope_;
        fundingTarget = fundingTarget_;
        maxTokens     = maxTokens_;
    }

    // ── Pricing ───────────────────────────────────────────────────────────────

    /// @notice Spot price at current supply
    function currentPrice() public view returns (uint256) {
        return basePrice + (slope * tokensSold) / 1e18;
    }

    /// @notice Cost to buy `amount` tokens from the current supply level
    /// @dev    Uses integral of linear function:
    ///         cost = amount × basePrice + slope × (2 × sold + amount) × amount / (2e18)
    function quoteBuy(uint256 amount) public view returns (uint256 cost) {
        require(amount > 0, "Curve: zero amount");
        // Linear integral: sum of arithmetic progression
        uint256 priceSum = amount * basePrice
            + (slope * (2 * tokensSold + amount) * amount) / (2 * 1e18);
        cost = priceSum;
    }

    // ── Buy ───────────────────────────────────────────────────────────────────

    /// @notice Purchase `amount` tokens at current bonding curve price
    /// @dev    Requires MINTER_ROLE granted to this contract on rwaToken
    function buy(uint256 amount) external nonReentrant {
        require(status == Status.OPEN,              "Curve: not open");
        require(amount > 0,                          "Curve: zero amount");
        require(tokensSold + amount <= maxTokens,    "Curve: exceeds max tokens");

        uint256 cost = quoteBuy(amount);
        paymentToken.safeTransferFrom(msg.sender, address(this), cost);

        // Mint tokens to buyer via MINTER_ROLE
        (bool ok, bytes memory data) = rwaToken.call(
            abi.encodeWithSignature("mint(address,uint256)", msg.sender, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))),
            "Curve: mint failed - grant MINTER_ROLE to this contract");

        tokensSold  += amount;
        fundsRaised += cost;

        emit TokensPurchased(msg.sender, amount, cost);

        if (fundsRaised >= fundingTarget && status == Status.OPEN) {
            status = Status.FUNDED;
            emit FundingTargetReached(fundsRaised);
        }
    }

    // ── Owner ─────────────────────────────────────────────────────────────────

    /// @notice Withdraw raised USDC to `to` (only when funded or closed)
    function withdrawFunds(address to) external onlyOwner {
        require(status != Status.OPEN, "Curve: still open");
        uint256 bal = paymentToken.balanceOf(address(this));
        require(bal > 0, "Curve: no funds");
        paymentToken.safeTransfer(to, bal);
        emit FundsWithdrawn(to, bal);
    }

    /// @notice Manually close the curve (even before target is reached)
    function close() external onlyOwner {
        require(status == Status.OPEN, "Curve: already closed");
        status = Status.CLOSED;
        emit CurveClosed();
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function remainingTokens()  external view returns (uint256) { return maxTokens - tokensSold; }
    function progressBps()      external view returns (uint256) {
        if (fundingTarget == 0) return 0;
        return fundsRaised * 10_000 / fundingTarget;
    }
}
