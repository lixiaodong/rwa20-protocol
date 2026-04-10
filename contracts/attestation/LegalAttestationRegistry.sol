// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ILegalAttestation.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  LegalAttestationRegistry
//
//  Central registry for on-chain legal proofs that link RWA20 assets to
//  real-world legal relationships. Two storage models coexist:
//
//  1. NATIVE attestations — submitted directly by trusted attestors
//     (on-chain legal bodies, licensed auditors, regulated entities)
//
//  2. BRIDGED attestations — imported from external protocols (EAS, Kleros)
//     via adapters (see EASAttestationAdapter.sol)
//
//  Trust model:
//    DEFAULT_ADMIN_ROLE → manages trusted attestors per jurisdiction+type
//    ATTESTOR_ROLE      → can submit native attestations
//    ASSET_LINKER_ROLE  → can link attestations to asset IDs (e.g. RWALaunchpad)
//    REVOKER_ROLE       → can revoke attestations (compliance emergency)
// ─────────────────────────────────────────────────────────────────────────────

contract LegalAttestationRegistry is ILegalAttestation, AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant ATTESTOR_ROLE     = keccak256("ATTESTOR_ROLE");
    bytes32 public constant ASSET_LINKER_ROLE = keccak256("ASSET_LINKER_ROLE");
    bytes32 public constant REVOKER_ROLE      = keccak256("REVOKER_ROLE");

    // ── Storage ───────────────────────────────────────────────────────────────

    /// uid → Attestation
    mapping(bytes32 => Attestation) private _attestations;

    /// jurisdiction → AttestationType → attestor → trusted
    mapping(bytes32 => mapping(AttestationType => mapping(address => bool))) private _trustedAttestors;

    /// assetId → list of attestation UIDs
    mapping(string => bytes32[]) private _assetAttestations;

    /// assetId → AttestationType → list of UIDs (for fast latest-lookup)
    mapping(string => mapping(AttestationType => bytes32[])) private _assetTypeAttestations;

    /// nonce for native UID generation (avoids collision with EAS UIDs)
    uint256 private _nonce;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REVOKER_ROLE,       admin);
    }

    // ── Trust management ──────────────────────────────────────────────────────

    /// @notice Grant or revoke trusted-attestor status for a jurisdiction + type
    function setTrustedAttestor(
        string calldata jurisdiction,
        AttestationType attestationType,
        address attestor,
        bool trusted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 jKey = keccak256(bytes(jurisdiction));
        _trustedAttestors[jKey][attestationType][attestor] = trusted;
        emit AttestorTrusted(jurisdiction, attestationType, attestor, trusted);
    }

    /// @notice Batch-grant trusted attestors for efficiency at launch
    function batchSetTrustedAttestors(
        string[]          calldata jurisdictions,
        AttestationType[] calldata types,
        address[]         calldata attestors,
        bool[]            calldata trusted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 len = jurisdictions.length;
        require(len == types.length && len == attestors.length && len == trusted.length, "Registry: length mismatch");
        for (uint256 i = 0; i < len; ++i) {
            bytes32 jKey = keccak256(bytes(jurisdictions[i]));
            _trustedAttestors[jKey][types[i]][attestors[i]] = trusted[i];
            emit AttestorTrusted(jurisdictions[i], types[i], attestors[i], trusted[i]);
        }
    }

    // ── Native attestation submission ─────────────────────────────────────────

    /// @notice Submit a new attestation from a trusted on-chain attestor
    /// @dev    The caller must hold ATTESTOR_ROLE AND be a trusted attestor for
    ///         the given jurisdiction + type. This dual-check prevents a generic
    ///         ATTESTOR_ROLE holder from submitting for jurisdictions they aren't
    ///         approved for.
    function submitAttestation(
        AttestationType attestationType,
        string calldata jurisdiction,
        bytes32         documentHash,
        string calldata ipfsCID,
        string calldata externalRef,
        string calldata legalBody,
        uint256         expiresAt,
        bytes32         schemaUID    // EAS schemaUID or bytes32(0) for native
    ) external onlyRole(ATTESTOR_ROLE) returns (bytes32 uid) {
        require(
            isTrustedAttestor(jurisdiction, attestationType, msg.sender),
            "Registry: not trusted for this jurisdiction+type"
        );

        uid = keccak256(abi.encodePacked(
            "NATIVE", block.chainid, address(this), ++_nonce,
            msg.sender, jurisdiction, uint8(attestationType), documentHash
        ));

        _attestations[uid] = Attestation({
            uid:             uid,
            attestationType: attestationType,
            attestor:        msg.sender,
            schemaUID:       schemaUID,
            jurisdiction:    jurisdiction,
            documentHash:    documentHash,
            ipfsCID:         ipfsCID,
            externalRef:     externalRef,
            legalBody:       legalBody,
            issuedAt:        block.timestamp,
            expiresAt:       expiresAt,
            revoked:         false
        });

        emit AttestationStored(uid, jurisdiction, attestationType, msg.sender);
    }

    /// @notice Import an attestation from an external adapter (EAS bridge, Kleros, etc.)
    /// @dev    Only authorized adapters (ATTESTOR_ROLE) may call this. The uid is
    ///         set by the adapter (e.g. EAS UID) — must not already exist.
    function importAttestation(
        Attestation calldata attestation
    ) external onlyRole(ATTESTOR_ROLE) {
        require(_attestations[attestation.uid].issuedAt == 0, "Registry: uid already exists");
        require(
            isTrustedAttestor(attestation.jurisdiction, attestation.attestationType, attestation.attestor),
            "Registry: attestor not trusted for this jurisdiction+type"
        );
        _attestations[attestation.uid] = attestation;
        emit AttestationStored(attestation.uid, attestation.jurisdiction, attestation.attestationType, attestation.attestor);
    }

    // ── Asset linkage ─────────────────────────────────────────────────────────

    /// @notice Link an attestation UID to an asset (e.g. "RE-MY-KL-001")
    /// @dev    Called by RWALaunchpad or asset issuer (ASSET_LINKER_ROLE)
    function linkAttestation(
        string calldata assetId,
        bytes32         uid
    ) external onlyRole(ASSET_LINKER_ROLE) {
        require(_attestations[uid].issuedAt > 0, "Registry: attestation not found");
        _assetAttestations[assetId].push(uid);
        _assetTypeAttestations[assetId][_attestations[uid].attestationType].push(uid);
    }

    /// @notice Batch link multiple attestations to an asset
    function batchLinkAttestations(
        string calldata assetId,
        bytes32[] calldata uids
    ) external onlyRole(ASSET_LINKER_ROLE) {
        for (uint256 i = 0; i < uids.length; ++i) {
            require(_attestations[uids[i]].issuedAt > 0, "Registry: attestation not found");
            _assetAttestations[assetId].push(uids[i]);
            _assetTypeAttestations[assetId][_attestations[uids[i]].attestationType].push(uids[i]);
        }
    }

    // ── Revocation ────────────────────────────────────────────────────────────

    /// @notice Revoke an attestation. Can be called by the original attestor or a REVOKER.
    function revoke(bytes32 uid) external {
        Attestation storage a = _attestations[uid];
        require(a.issuedAt > 0, "Registry: not found");
        require(
            a.attestor == msg.sender || hasRole(REVOKER_ROLE, msg.sender),
            "Registry: not authorized to revoke"
        );
        a.revoked = true;
        emit AttestationRevoked(uid, msg.sender);
    }

    // ── ILegalAttestation ─────────────────────────────────────────────────────

    function getAttestation(bytes32 uid)
        external view override returns (Attestation memory)
    {
        return _attestations[uid];
    }

    function isValid(bytes32 uid) public view override returns (bool) {
        Attestation storage a = _attestations[uid];
        if (a.issuedAt == 0)   return false;   // doesn't exist
        if (a.revoked)         return false;   // revoked
        if (a.expiresAt > 0 && block.timestamp > a.expiresAt) return false; // expired
        return true;
    }

    function isTrustedAttestor(
        string calldata jurisdiction,
        AttestationType attestationType,
        address attestor
    ) public view override returns (bool) {
        bytes32 jKey = keccak256(bytes(jurisdiction));
        return _trustedAttestors[jKey][attestationType][attestor];
    }

    function getAssetAttestations(string calldata assetId)
        external view override returns (bytes32[] memory)
    {
        return _assetAttestations[assetId];
    }

    function hasValidAttestation(
        string calldata assetId,
        AttestationType attestationType
    ) external view override returns (bool) {
        bytes32[] storage uids = _assetTypeAttestations[assetId][attestationType];
        for (uint256 i = uids.length; i > 0; --i) {
            if (isValid(uids[i - 1])) return true;
        }
        return false;
    }

    function getLatestAttestation(
        string calldata assetId,
        AttestationType attestationType
    ) external view override returns (bytes32 uid, bool found) {
        bytes32[] storage uids = _assetTypeAttestations[assetId][attestationType];
        // Traverse in reverse — last pushed is most recent
        for (uint256 i = uids.length; i > 0; --i) {
            bytes32 candidate = uids[i - 1];
            if (isValid(candidate)) {
                return (candidate, true);
            }
        }
        return (bytes32(0), false);
    }
}
