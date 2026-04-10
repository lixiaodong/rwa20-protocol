// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//  RWA20 — Interface & shared data types
//  Inspired by ERC-20 but extended for real-world asset tokenization
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Classification of the underlying real-world asset
enum AssetType {
    REAL_ESTATE,   // 0 — land, buildings, REITs
    AGRICULTURE,   // 1 — crops, farms (e.g. durian)
    GOLD,          // 2 — precious metals
    DEBT           // 3 — bonds, invoice finance
}

/// @notice Legal wrapper information
struct LegalInfo {
    string  spvName;        // Special Purpose Vehicle entity name
    string  jurisdiction;   // ISO 3166-1 alpha-2 country code, e.g. "MY"
    bytes32 agreementHash;  // keccak256 / IPFS CID of the legal agreement
}

/// @notice Custody and audit record
struct CustodyInfo {
    address custodian;           // On-chain address or identifier of custodian
    bytes32 auditProof;          // Hash of the latest independent audit report
    uint256 lastAuditTimestamp;  // Unix timestamp of last audit
}

// ─────────────────────────────────────────────────────────────────────────────

interface IRWA20 {
    // ── View ──────────────────────────────────────────────────────────────────

    /// @notice The type of real-world asset backing this token
    function assetType() external view returns (AssetType);

    /// @notice Off-chain identifier for the specific asset
    function assetId() external view returns (string memory);

    /// @notice Structured legal information about the SPV / agreement
    function legalInfo() external view returns (LegalInfo memory);

    /// @notice Custody and audit information
    function custodyInfo() external view returns (CustodyInfo memory);

    /// @notice Address of the pluggable compliance module (0x0 = disabled)
    function complianceModule() external view returns (address);

    /// @notice Address of the asset oracle
    function oracle() external view returns (address);

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// @notice Replace the compliance module (address(0) disables compliance)
    function setComplianceModule(address module) external;

    /// @notice Replace the oracle
    function setOracle(address oracle_) external;

    /// @notice Update the legal information struct
    function updateLegalInfo(LegalInfo calldata info) external;

    /// @notice Update the custody / audit information
    function updateCustodyInfo(CustodyInfo calldata info) external;

    // ── Events ────────────────────────────────────────────────────────────────

    event ComplianceModuleUpdated(address indexed oldModule, address indexed newModule);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event LegalInfoUpdated(bytes32 indexed agreementHash);
    event CustodyInfoUpdated(address indexed custodian, bytes32 indexed auditProof);
}
