import { expect }      from "chai";
import { ethers }      from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { RWALaunchpad, RWA20Factory, MockUSDC } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────

const defaultLegalInfo = {
  spvName:       "TestSPV Ltd",
  jurisdiction:  "MY",
  agreementHash: ethers.ZeroHash,
};

async function deployLaunchpadFixture() {
  const [deployer, issuer, buyer] = await ethers.getSigners();

  const USDC     = await ethers.getContractFactory("MockUSDC");
  const usdc     = await USDC.deploy() as MockUSDC;

  const Factory  = await ethers.getContractFactory("RWA20Factory");
  const factory  = await Factory.deploy() as RWA20Factory;

  const Launchpad = await ethers.getContractFactory("RWALaunchpad");
  const launchpad = await Launchpad.deploy(
    await factory.getAddress(),
    await usdc.getAddress(),
    ethers.parseUnits("10", 6)     // $10 launch fee
  ) as RWALaunchpad;

  // Fund issuer with USDC
  await usdc.mint(issuer.address, ethers.parseUnits("1000", 6));
  await usdc.connect(issuer).approve(await launchpad.getAddress(), ethers.parseUnits("1000", 6));

  return { launchpad, factory, usdc, deployer, issuer, buyer };
}

const realEstateLaunchConfig = {
  name:           "Test Real Estate Token",
  symbol:         "TRET",
  assetType:      0,               // REAL_ESTATE
  assetId:        "RE-TEST-001",
  legalInfo:      defaultLegalInfo,
  useCompliance:  true,
  initialSupply:  ethers.parseEther("100000"),
  fundingTarget:  0n,              // No bonding curve
  curveMaxTokens: 0n,
  bondingBasePrice: 0n,
  bondingSlope:     0n,
};

const agricultureLaunchConfig = {
  name:             "Test Durian Token",
  symbol:           "TDURIAN",
  assetType:        1,             // AGRICULTURE
  assetId:          "AG-TEST-001",
  legalInfo:        defaultLegalInfo,
  useCompliance:    false,
  initialSupply:    0n,
  fundingTarget:    ethers.parseUnits("10000", 6),
  curveMaxTokens:   ethers.parseEther("100000"),
  bondingBasePrice: ethers.parseUnits("0.1", 18),
  bondingSlope:     ethers.parseUnits("0.000001", 18),
};

// ─────────────────────────────────────────────────────────────────────────────

describe("RWALaunchpad", () => {

  describe("Launch: Real Estate (with compliance, no bonding curve)", () => {
    it("should deploy token stack successfully", async () => {
      const { launchpad, issuer } = await loadFixture(deployLaunchpadFixture);

      const tx      = await launchpad.connect(issuer).launch(realEstateLaunchConfig);
      const receipt = await tx.wait();

      expect(await launchpad.assetCount()).to.equal(1n);

      const asset = await launchpad.getAsset(0);
      expect(asset.token).to.not.equal(ethers.ZeroAddress);
      expect(asset.compliance).to.not.equal(ethers.ZeroAddress);
      expect(asset.oracle).to.not.equal(ethers.ZeroAddress);
      expect(asset.distributor).to.not.equal(ethers.ZeroAddress);
      expect(asset.wrapper).to.not.equal(ethers.ZeroAddress);
      expect(asset.bondingCurve).to.equal(ethers.ZeroAddress); // no curve
      expect(asset.issuer).to.equal(issuer.address);
    });

    it("should mint initial supply to issuer", async () => {
      const { launchpad, issuer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(realEstateLaunchConfig);

      const asset = await launchpad.getAsset(0);
      const token = await ethers.getContractAt("RWA20Token", asset.token);
      expect(await token.balanceOf(issuer.address)).to.equal(ethers.parseEther("100000"));
    });

    it("should collect launch fee", async () => {
      const { launchpad, usdc, issuer } = await loadFixture(deployLaunchpadFixture);
      const balBefore = await usdc.balanceOf(await launchpad.getAddress());
      await launchpad.connect(issuer).launch(realEstateLaunchConfig);
      const balAfter  = await usdc.balanceOf(await launchpad.getAddress());
      expect(balAfter - balBefore).to.equal(ethers.parseUnits("10", 6));
    });

    it("should use BasicCompliance for real estate with useCompliance=true", async () => {
      const { launchpad, issuer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(realEstateLaunchConfig);
      const asset = await launchpad.getAsset(0);
      // BasicCompliance has COMPLIANCE_ADMIN role
      const compliance = await ethers.getContractAt("BasicCompliance", asset.compliance);
      expect(await compliance.minTier()).to.equal(1n); // RETAIL
    });

    it("should register asset under issuer", async () => {
      const { launchpad, issuer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(realEstateLaunchConfig);
      const indices = await launchpad.getIssuerAssets(issuer.address);
      expect(indices.length).to.equal(1);
      expect(indices[0]).to.equal(0n);
    });
  });

  describe("Launch: Agriculture (no compliance, with bonding curve)", () => {
    it("should deploy bonding curve", async () => {
      const { launchpad, issuer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(agricultureLaunchConfig);

      const asset = await launchpad.getAsset(0);
      expect(asset.bondingCurve).to.not.equal(ethers.ZeroAddress);
    });

    it("should allow buying tokens from bonding curve", async () => {
      const { launchpad, usdc, issuer, buyer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(agricultureLaunchConfig);
      const asset = await launchpad.getAsset(0);

      const curve = await ethers.getContractAt("BondingCurve", asset.bondingCurve);
      const token = await ethers.getContractAt("RWA20Token",   asset.token);

      // Buy 1000 tokens
      const buyAmt = ethers.parseEther("1000");
      const cost   = await curve.quoteBuy(buyAmt);

      await usdc.mint(buyer.address, ethers.parseUnits("1000", 6));
      await usdc.connect(buyer).approve(asset.bondingCurve, ethers.parseUnits("1000", 6));
      await curve.connect(buyer).buy(buyAmt);

      expect(await token.balanceOf(buyer.address)).to.equal(buyAmt);
    });

    it("should use NoCompliance for agriculture with useCompliance=false", async () => {
      const { launchpad, issuer, buyer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(agricultureLaunchConfig);
      const asset = await launchpad.getAsset(0);
      const token = await ethers.getContractAt("RWA20Token", asset.token);

      // Direct transfer should work with no compliance
      await launchpad.connect(issuer).launch({
        ...realEstateLaunchConfig,
        useCompliance: false,
        initialSupply: ethers.parseEther("1000"),
      });
      const asset2  = await launchpad.getAsset(1);
      const token2  = await ethers.getContractAt("RWA20Token", asset2.token);
      await token2.connect(issuer).transfer(buyer.address, ethers.parseEther("100"));
      expect(await token2.balanceOf(buyer.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Admin", () => {
    it("should allow owner to update launch fee", async () => {
      const { launchpad, deployer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(deployer).setLaunchFee(ethers.parseUnits("50", 6));
      expect(await launchpad.launchFee()).to.equal(ethers.parseUnits("50", 6));
    });

    it("should allow owner to withdraw fees", async () => {
      const { launchpad, usdc, deployer, issuer } = await loadFixture(deployLaunchpadFixture);
      await launchpad.connect(issuer).launch(realEstateLaunchConfig);

      const before = await usdc.balanceOf(deployer.address);
      await launchpad.connect(deployer).withdrawFees(deployer.address);
      const after  = await usdc.balanceOf(deployer.address);
      expect(after - before).to.equal(ethers.parseUnits("10", 6));
    });
  });
});
