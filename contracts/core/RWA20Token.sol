// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IRWA20.sol";
import "../compliance/IComplianceModule.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  RWA20Token
//  Core ERC-20 token extended with:
//    • RWA metadata (assetType, assetId, legalInfo, custodyInfo)
//    • Pluggable compliance module (KYC, jurisdiction, investor tier)
//    • ERC20Votes checkpoints for snapshot-based revenue distribution
//    • Role-based access control (ADMIN / MINTER / PAUSER / ORACLE)
//    • ERC2612 permit for gasless approvals
// ─────────────────────────────────────────────────────────────────────────────

contract RWA20Token is ERC20, ERC20Permit, ERC20Votes, AccessControl, Pausable, IRWA20 {
    // ── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    // ── RWA State ─────────────────────────────────────────────────────────────
    AssetType   private _assetType;
    string      private _assetId;
    LegalInfo   private _legalInfo;
    CustodyInfo private _custodyInfo;
    address     private _complianceModule;
    address     private _oracle;

    uint8 private immutable _tokenDecimals;

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param name_             Token name (e.g. "KL Tower Office Token")
    /// @param symbol_           Token symbol (e.g. "KLTO")
    /// @param decimals_         Decimal places (18 for most RWA tokens)
    /// @param assetType_        Enum: REAL_ESTATE / AGRICULTURE / GOLD / DEBT
    /// @param assetId_          Off-chain asset identifier (e.g. "RE-MY-001")
    /// @param legalInfo_        SPV name, jurisdiction, agreement hash
    /// @param admin_            Address granted DEFAULT_ADMIN + all roles
    /// @param complianceModule_ Compliance contract (address(0) = no compliance)
    constructor(
        string    memory name_,
        string    memory symbol_,
        uint8     decimals_,
        AssetType assetType_,
        string    memory assetId_,
        LegalInfo memory legalInfo_,
        address   admin_,
        address   complianceModule_
    )
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        _tokenDecimals    = decimals_;
        _assetType        = assetType_;
        _assetId          = assetId_;
        _legalInfo        = legalInfo_;
        _complianceModule = complianceModule_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE,        admin_);
        _grantRole(PAUSER_ROLE,        admin_);
        _grantRole(ORACLE_ROLE,        admin_);
    }

    // ── ERC20 overrides ───────────────────────────────────────────────────────

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    /// @dev Core transfer hook — applies compliance check + ERC20Votes checkpoint
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
        whenNotPaused
    {
        // Skip compliance for mints (from == address(0))
        if (_complianceModule != address(0) && from != address(0)) {
            (bool ok, string memory reason) =
                IComplianceModule(_complianceModule).canTransfer(from, to, amount);
            require(ok, reason);
        }

        super._update(from, to, amount);

        // Post-transfer hook (e.g. count transfers for analytics)
        if (_complianceModule != address(0) && from != address(0)) {
            IComplianceModule(_complianceModule).onTransfer(from, to, amount);
        }
    }

    /// @dev Required by Solidity: resolve nonces() ambiguity between Permit & Nonces
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // ── Minting & Burning ─────────────────────────────────────────────────────

    /// @notice Mint tokens to `to`. Auto-delegates so revenue snapshots work.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        // Auto-self-delegate on first receive so ERC20Votes checkpoints are tracked
        if (delegates(to) == address(0)) {
            _delegate(to, to);
        }
        _mint(to, amount);
    }

    /// @notice Admin burn (for redemptions)
    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    /// @notice Self-burn (for redemptions without admin role)
    function burnSelf(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ── IRWA20 ────────────────────────────────────────────────────────────────

    function assetType()        external view override returns (AssetType)     { return _assetType; }
    function assetId()          external view override returns (string memory)  { return _assetId; }
    function legalInfo()        external view override returns (LegalInfo memory)   { return _legalInfo; }
    function custodyInfo()      external view override returns (CustodyInfo memory) { return _custodyInfo; }
    function complianceModule() external view override returns (address)        { return _complianceModule; }
    function oracle()           external view override returns (address)        { return _oracle; }

    function setComplianceModule(address module)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address old = _complianceModule;
        _complianceModule = module;
        emit ComplianceModuleUpdated(old, module);
    }

    function setOracle(address oracle_)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address old = _oracle;
        _oracle = oracle_;
        emit OracleUpdated(old, oracle_);
    }

    function updateLegalInfo(LegalInfo calldata info)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _legalInfo = info;
        emit LegalInfoUpdated(info.agreementHash);
    }

    function updateCustodyInfo(CustodyInfo calldata info)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _custodyInfo = info;
        emit CustodyInfoUpdated(info.custodian, info.auditProof);
    }
}
