// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RWA20Token.sol";
import "../compliance/BasicCompliance.sol";
import "../compliance/NoCompliance.sol";
import "../revenue/RevenueDistributor.sol";
import "../oracle/AssetOracle.sol";
import "../wrapper/WRWA20.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  RWA20Factory
//  One-call deployer that wires together the full RWA20 protocol stack:
//    RWA20Token  →  Compliance  →  Oracle  →  RevenueDistributor  →  WRWA20
// ─────────────────────────────────────────────────────────────────────────────

contract RWA20Factory is Ownable {
    // ── Parameter struct ──────────────────────────────────────────────────────

    struct DeployParams {
        string    name;
        string    symbol;
        uint8     decimals;         // usually 18
        AssetType assetType;
        string    assetId;          // e.g. "RE-KL-TOWER-001"
        LegalInfo legalInfo;
        uint256   initialSupply;    // tokens minted to issuer on deploy
        address   rewardToken;      // USDC or other stablecoin
        bool      useCompliance;    // false → NoCompliance (open trading)
        address   complianceAdmin;  // admin for the compliance module
    }

    // ── Return struct ─────────────────────────────────────────────────────────

    struct DeployedContracts {
        address token;
        address compliance;
        address oracle;
        address distributor;
        address wrapper;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    DeployedContracts[] public deployments;
    mapping(address => address) public tokenToOracle;
    mapping(address => address) public tokenToDistributor;
    mapping(address => address) public tokenToWrapper;

    // ── Events ────────────────────────────────────────────────────────────────

    event AssetDeployed(
        address indexed token,
        address indexed compliance,
        address         oracle,
        address         distributor,
        address         wrapper,
        AssetType indexed assetType,
        string          assetId
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Deploy ────────────────────────────────────────────────────────────────

    /// @notice Deploy a complete RWA20 token stack
    /// @param p      Deployment parameters
    /// @param issuer Address that will receive admin roles and initial supply
    /// @return result Addresses of all deployed contracts
    function deploy(DeployParams calldata p, address issuer)
        external
        returns (DeployedContracts memory result)
    {
        // 1 ── Compliance module ──────────────────────────────────────────────
        address complianceAddr;
        if (p.useCompliance) {
            BasicCompliance compliance = new BasicCompliance(p.complianceAdmin);
            complianceAddr = address(compliance);
        } else {
            NoCompliance nc = new NoCompliance();
            complianceAddr = address(nc);
        }

        // 2 ── Core RWA20 token ───────────────────────────────────────────────
        RWA20Token token = new RWA20Token(
            p.name,
            p.symbol,
            p.decimals,
            p.assetType,
            p.assetId,
            p.legalInfo,
            issuer,
            complianceAddr
        );

        // 3 ── Oracle ─────────────────────────────────────────────────────────
        AssetOracle oracleContract = new AssetOracle(issuer);
        token.setOracle(address(oracleContract));

        // 4 ── Revenue distributor ─────────────────────────────────────────────
        RevenueDistributor distributor = new RevenueDistributor(
            address(token),
            p.rewardToken,
            issuer
        );

        // 5 ── Wrapper (freely tradable version for DEX) ──────────────────────
        WRWA20 wrapper = new WRWA20(
            address(token),
            string.concat("Wrapped ", p.name),
            string.concat("w", p.symbol)
        );

        // 6 ── Mint initial supply to issuer ──────────────────────────────────
        if (p.initialSupply > 0) {
            token.mint(issuer, p.initialSupply);
        }

        // 7 ── Record ─────────────────────────────────────────────────────────
        result = DeployedContracts({
            token:       address(token),
            compliance:  complianceAddr,
            oracle:      address(oracleContract),
            distributor: address(distributor),
            wrapper:     address(wrapper)
        });

        deployments.push(result);
        tokenToOracle[address(token)]      = address(oracleContract);
        tokenToDistributor[address(token)] = address(distributor);
        tokenToWrapper[address(token)]     = address(wrapper);

        emit AssetDeployed(
            address(token),
            complianceAddr,
            address(oracleContract),
            address(distributor),
            address(wrapper),
            p.assetType,
            p.assetId
        );
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function deploymentCount() external view returns (uint256) {
        return deployments.length;
    }

    function getDeployment(uint256 idx) external view returns (DeployedContracts memory) {
        return deployments[idx];
    }
}
