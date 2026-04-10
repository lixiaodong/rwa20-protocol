// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//  IComplianceModule
//  Pluggable compliance interface consumed by RWA20Token._update()
//  Implement this interface to add any compliance logic:
//    KYC / AML checks, jurisdiction restrictions, transfer limits, etc.
// ─────────────────────────────────────────────────────────────────────────────

interface IComplianceModule {
    // ── Core ──────────────────────────────────────────────────────────────────

    /// @notice Pre-transfer check.
    /// @param from    Sender (address(0) on mint — implementations should allow mints)
    /// @param to      Receiver
    /// @param amount  Token amount
    /// @return allowed  True if the transfer should proceed
    /// @return reason   Human-readable denial reason (empty if allowed)
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool allowed, string memory reason);

    /// @notice Post-transfer hook. Called after every successful transfer.
    ///         Use for analytics, transfer counting, or any stateful side-effect.
    function onTransfer(address from, address to, uint256 amount) external;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when an address's KYC / whitelist status changes
    event AddressStatusUpdated(address indexed account, bool status);
}
