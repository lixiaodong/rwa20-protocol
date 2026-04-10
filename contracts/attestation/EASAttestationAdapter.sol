// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ILegalAttestation.sol";
import "./LegalAttestationRegistry.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  EASAttestationAdapter
//
//  Bridges Ethereum Attestation Service (EAS) attestations into the RWA20
//  LegalAttestationRegistry. EAS is a general-purpose on-chain attestation
//  protocol deployed on Ethereum, Optimism, Base, Arbitrum, Polygon, etc.
//
//  Mainnet EAS contract:  0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587
//  Sepolia EAS contract:  0xC2679fBD37d54388Ce493F1DB75320D236e1815e
//  EAS Explorer:          https://easscan.org
//
//  How it works:
//  ─────────────
//  1. An on-chain legal body (land registry, court, auditor) issues an EAS
//     attestation using a pre-registered schema (schemaUID).
//  2. This adapter reads that attestation from the IEAS interface and maps it
//     into an RWA20 Attestation struct.
//  3. The adapter calls LegalAttestationRegistry.importAttestation() to anchor
//     the proof within the RWA20 protocol.
//  4. Any subsequent compliance check or asset proof lookup uses the local
//     registry (cheaper) — EAS is the source of truth, this is the local cache.
//
//  Known EAS Schema UIDs (illustrative — register your own at app.eas.eth):
//  ─────────────────────────────────────────────────────────────────────────
//  PROPERTY_TITLE  (SLA Singapore): 0x...  (issuer = SLA authorized signer)
//  KYC_IDENTITY    (SingPass NDID): 0x...  (issuer = MyInfo data relay)
//  AUDIT_CERT      (BIG4 auditor):  0x...  (issuer = licensed audit firm wallet)
//  COURT_ORDER     (ADGM/DIFC):     0x...  (issuer = court-authorized signer)
// ─────────────────────────────────────────────────────────────────────────────

/// @notice Minimal EAS interface — only what we need
interface IEAS {
    struct EASAttestation {
        bytes32 uid;
        bytes32 schema;
        uint64  time;
        uint64  expirationTime;
        uint64  revocationTime;
        bytes32 refUID;
        address recipient;
        address attester;
        bool    revocable;
        bytes   data;
    }

    function getAttestation(bytes32 uid) external view returns (EASAttestation memory);
    function isAttestationValid(bytes32 uid) external view returns (bool);
}

/// @notice Schema configuration: maps an EAS schemaUID to an AttestationType + jurisdiction
struct EASSchemaConfig {
    AttestationType attestationType;
    string          jurisdiction;
    string          legalBody;
    bool            active;
}

contract EASAttestationAdapter is AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant BRIDGE_ROLE  = keccak256("BRIDGE_ROLE");
    bytes32 public constant SCHEMA_ADMIN = keccak256("SCHEMA_ADMIN");

    // ── State ─────────────────────────────────────────────────────────────────

    IEAS                       public immutable eas;
    LegalAttestationRegistry   public immutable registry;

    /// schemaUID → schema configuration
    mapping(bytes32 => EASSchemaConfig) public schemas;

    /// EAS UID → already imported (avoid re-import)
    mapping(bytes32 => bool) public imported;

    // ── Events ────────────────────────────────────────────────────────────────

    event SchemaRegistered(bytes32 indexed schemaUID, AttestationType attestationType, string jurisdiction, string legalBody);
    event EASAttestationBridged(bytes32 indexed easUID, string jurisdiction, AttestationType attestationType);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address easAddress,
        address registryAddress,
        address admin
    ) {
        eas      = IEAS(easAddress);
        registry = LegalAttestationRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SCHEMA_ADMIN,       admin);
        _grantRole(BRIDGE_ROLE,        admin);
    }

    // ── Schema management ─────────────────────────────────────────────────────

    /// @notice Register an EAS schema as a known legal proof type
    /// @param schemaUID    The EAS schema UID (bytes32)
    /// @param aType        Corresponding RWA20 AttestationType
    /// @param jurisdiction ISO 3166-1 alpha-2 (e.g. "SG", "AE")
    /// @param legalBody    Human-readable name of the issuing institution
    function registerSchema(
        bytes32         schemaUID,
        AttestationType aType,
        string calldata jurisdiction,
        string calldata legalBody
    ) external onlyRole(SCHEMA_ADMIN) {
        schemas[schemaUID] = EASSchemaConfig({
            attestationType: aType,
            jurisdiction:    jurisdiction,
            legalBody:       legalBody,
            active:          true
        });
        emit SchemaRegistered(schemaUID, aType, jurisdiction, legalBody);
    }

    /// @notice Deactivate a schema (stop bridging new attestations from it)
    function deactivateSchema(bytes32 schemaUID) external onlyRole(SCHEMA_ADMIN) {
        schemas[schemaUID].active = false;
    }

    // ── Bridge ────────────────────────────────────────────────────────────────

    /// @notice Import a single EAS attestation into the RWA20 registry
    /// @param easUID       The UID of the EAS attestation to import
    /// @param documentHash keccak256 of the underlying legal document (caller provides)
    /// @param ipfsCID      IPFS CID of the full document (caller provides, may be "")
    /// @param externalRef  Human-readable external reference (title number, court case, etc.)
    function bridgeAttestation(
        bytes32 easUID,
        bytes32 documentHash,
        string calldata ipfsCID,
        string calldata externalRef
    ) external onlyRole(BRIDGE_ROLE) {
        require(!imported[easUID], "EASAdapter: already imported");
        require(eas.isAttestationValid(easUID), "EASAdapter: invalid EAS attestation");

        IEAS.EASAttestation memory ea = eas.getAttestation(easUID);
        EASSchemaConfig storage cfg   = schemas[ea.schema];
        require(cfg.active, "EASAdapter: schema not registered or inactive");

        Attestation memory a = Attestation({
            uid:             easUID,
            attestationType: cfg.attestationType,
            attestor:        ea.attester,
            schemaUID:       ea.schema,
            jurisdiction:    cfg.jurisdiction,
            documentHash:    documentHash,
            ipfsCID:         ipfsCID,
            externalRef:     externalRef,
            legalBody:       cfg.legalBody,
            issuedAt:        ea.time,
            expiresAt:       ea.expirationTime,
            revoked:         ea.revocationTime > 0
        });

        registry.importAttestation(a);
        imported[easUID] = true;

        emit EASAttestationBridged(easUID, cfg.jurisdiction, cfg.attestationType);
    }

    /// @notice Batch bridge multiple EAS attestations in one call
    function batchBridgeAttestations(
        bytes32[]  calldata easUIDs,
        bytes32[]  calldata documentHashes,
        string[]   calldata ipfsCIDs,
        string[]   calldata externalRefs
    ) external onlyRole(BRIDGE_ROLE) {
        uint256 len = easUIDs.length;
        require(
            len == documentHashes.length && len == ipfsCIDs.length && len == externalRefs.length,
            "EASAdapter: length mismatch"
        );
        for (uint256 i = 0; i < len; ++i) {
            if (!imported[easUIDs[i]] && eas.isAttestationValid(easUIDs[i])) {
                IEAS.EASAttestation memory ea = eas.getAttestation(easUIDs[i]);
                EASSchemaConfig storage cfg   = schemas[ea.schema];
                if (!cfg.active) continue;

                Attestation memory a = Attestation({
                    uid:             easUIDs[i],
                    attestationType: cfg.attestationType,
                    attestor:        ea.attester,
                    schemaUID:       ea.schema,
                    jurisdiction:    cfg.jurisdiction,
                    documentHash:    documentHashes[i],
                    ipfsCID:         ipfsCIDs[i],
                    externalRef:     externalRefs[i],
                    legalBody:       cfg.legalBody,
                    issuedAt:        ea.time,
                    expiresAt:       ea.expirationTime,
                    revoked:         ea.revocationTime > 0
                });

                registry.importAttestation(a);
                imported[easUIDs[i]] = true;
                emit EASAttestationBridged(easUIDs[i], cfg.jurisdiction, cfg.attestationType);
            }
        }
    }

    // ── Sync revocation ───────────────────────────────────────────────────────

    /// @notice Sync a revocation from EAS — if EAS has revoked it, revoke locally too
    function syncRevocation(bytes32 easUID) external {
        require(imported[easUID], "EASAdapter: not imported");
        if (!eas.isAttestationValid(easUID)) {
            registry.revoke(easUID);
        }
    }
}
