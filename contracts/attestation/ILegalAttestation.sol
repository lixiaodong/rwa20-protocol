// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//  ILegalAttestation
//
//  Canonical interface for on-chain legal proofs linking tokenized RWA20 assets
//  to real-world legal relationships. Designed to be pluggable across:
//
//  ┌──────────────────────────────────────────────────────────┐
//  │  On-chain Legal Bodies Supported                         │
//  ├────────────────────────────┬─────────────────────────────┤
//  │  EAS (Ethereum Attestation │  Universal attestation      │
//  │  Service)                  │  protocol on L1/L2          │
//  ├────────────────────────────┼─────────────────────────────┤
//  │  Kleros Arbitration        │  Decentralized on-chain     │
//  │                            │  dispute resolution         │
//  ├────────────────────────────┼─────────────────────────────┤
//  │  ADGM/DIFC Digital Courts  │  UAE internationally-       │
//  │                            │  recognized common law      │
//  ├────────────────────────────┼─────────────────────────────┤
//  │  Liechtenstein TVTG        │  Token Container Model —    │
//  │  FMA Registry              │  token IS the legal claim   │
//  ├────────────────────────────┼─────────────────────────────┤
//  │  Singapore MAS / SingPass  │  Digital identity + MAS     │
//  │                            │  regulated VCC structures   │
//  └────────────────────────────┴─────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Types of legal attestations that can be anchored on-chain
enum AttestationType {
    PROPERTY_TITLE,        // Land title / deed of ownership (SLA, Land Registry)
    CORPORATE_RECORD,      // SPV incorporation, shareholder register (ACRA, Handelsregister)
    COURT_ORDER,           // Court order, judgment, receivership (ADGM, DIFC, Kleros)
    AUDIT_CERTIFICATE,     // Independent asset audit / valuation (Big 4, accredited auditors)
    KYC_VERIFICATION,      // Know Your Customer identity proof (licensed VASPs, SingPass)
    REGULATORY_APPROVAL,   // Regulator license or approval (MAS, FINMA, VARA, SEC)
    VALUATION_REPORT,      // Asset NAV / appraisal report (licensed valuers)
    CUSTODY_PROOF,         // Proof of custody / safekeeping (licensed custodians)
    LEGAL_OPINION          // Legal opinion letter (licensed law firms)
}

/// @notice A single legal attestation anchored on-chain
struct Attestation {
    bytes32 uid;               // Unique identifier (EAS UID or keccak256 of local data)
    AttestationType attestationType;
    address attestor;          // Who issued this attestation (trusted registry entry)
    bytes32 schemaUID;         // EAS schema UID (bytes32(0) if non-EAS)
    string  jurisdiction;      // ISO 3166-1 alpha-2 (e.g. "SG", "CH", "AE", "LI", "MY", "US")
    bytes32 documentHash;      // keccak256 of off-chain legal document
    string  ipfsCID;           // IPFS CID of the full document (e.g. "QmXyz...")
    string  externalRef;       // Human-readable ref: "ACRA 202412345A", "SLA Vol 123 Folio 456"
    string  legalBody;         // Issuing institution: "Singapore Land Authority", "Kleros Court #5"
    uint256 issuedAt;          // Unix timestamp
    uint256 expiresAt;         // 0 = never expires
    bool    revoked;           // Can be revoked by attestor or admin
}

/// @title ILegalAttestation
/// @notice Interface for registries that store and validate on-chain legal proofs
interface ILegalAttestation {

    // ── Events ────────────────────────────────────────────────────────────────

    event AttestationStored(bytes32 indexed uid, string indexed jurisdiction, AttestationType attestationType, address attestor);
    event AttestationRevoked(bytes32 indexed uid, address revokedBy);
    event AttestorTrusted(string indexed jurisdiction, AttestationType attestationType, address attestor, bool trusted);

    // ── Core queries ──────────────────────────────────────────────────────────

    /// @notice Retrieve a single attestation by its UID
    function getAttestation(bytes32 uid) external view returns (Attestation memory);

    /// @notice Check if an attestation is valid (exists, not revoked, not expired)
    function isValid(bytes32 uid) external view returns (bool);

    /// @notice Check if an address is a trusted attestor for a given type in a jurisdiction
    function isTrustedAttestor(
        string calldata jurisdiction,
        AttestationType attestationType,
        address attestor
    ) external view returns (bool);

    // ── Asset linkage ─────────────────────────────────────────────────────────

    /// @notice Get all attestation UIDs linked to a specific asset (by assetId)
    function getAssetAttestations(string calldata assetId) external view returns (bytes32[] memory);

    /// @notice Check whether an asset has a valid attestation of a specific type
    function hasValidAttestation(
        string calldata assetId,
        AttestationType attestationType
    ) external view returns (bool);

    /// @notice Get the most recent valid attestation UID of a specific type for an asset
    function getLatestAttestation(
        string calldata assetId,
        AttestationType attestationType
    ) external view returns (bytes32 uid, bool found);
}
