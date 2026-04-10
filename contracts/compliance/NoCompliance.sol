// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IComplianceModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  NoCompliance
//  Pass-through compliance module — always allows transfers.
//  Use for:
//    • Governance tokens with no transfer restrictions
//    • Wrapper tokens (WRWA20) that trade freely on DEXes
//    • Development / testing environments
// ─────────────────────────────────────────────────────────────────────────────

contract NoCompliance is IComplianceModule {
    function canTransfer(address, address, uint256)
        external
        pure
        override
        returns (bool, string memory)
    {
        return (true, "");
    }

    function onTransfer(address, address, uint256) external override {}
}
