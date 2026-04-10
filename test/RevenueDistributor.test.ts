import { expect }                      from "chai";
import { ethers }                      from "hardhat";
import { loadFixture, mine }           from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { RWA20Token, RevenueDistributor, MockUSDC } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────

const defaultLegalInfo = {
  spvName:       "Test SPV",
  jurisdiction:  "MY",
  agreementHash: ethers.ZeroHash,
};

async function deployRevenueFixture() {
  const [admin, alice, bob, charlie] = await ethers.getSigners();

  // MockUSDC
  const USDC  = await ethers.getContractFactory("MockUSDC");
  const usdc  = await USDC.deploy() as MockUSDC;

  // NoCompliance
  const NoComp = await ethers.getContractFactory("NoCompliance");
  const noComp = await NoComp.deploy();

  // RWA20Token
  const Token = await ethers.getContractFactory("RWA20Token");
  const token = await Token.deploy(
    "Revenue Token",
    "RVT",
    18,
    0,
    "TEST-001",
    defaultLegalInfo,
    admin.address,
    await noComp.getAddress()
  ) as RWA20Token;

  // RevenueDistributor
  const Dist = await ethers.getContractFactory("RevenueDistributor");
  const dist = await Dist.deploy(
    await token.getAddress(),
    await usdc.getAddress(),
    admin.address
  ) as RevenueDistributor;

  // Mint tokens: alice 600, bob 400
  await token.connect(admin).mint(alice.address,   ethers.parseEther("600"));
  await token.connect(admin).mint(bob.address,     ethers.parseEther("400"));
  await token.connect(admin).mint(charlie.address, ethers.parseEther("0"));

  // Mine a block so getPastVotes works
  await mine(1);

  // Fund admin with USDC
  await usdc.faucet();

  return { token, usdc, dist, admin, alice, bob, charlie };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("RevenueDistributor", () => {

  describe("Period creation", () => {
    it("should create a period and pull USDC", async () => {
      const { usdc, dist, admin } = await loadFixture(deployRevenueFixture);
      const amount = ethers.parseUnits("1000", 6);
      await usdc.connect(admin).approve(await dist.getAddress(), amount);
      await dist.connect(admin).createPeriod(amount, "Q1 Income");

      const period = await dist.periods(0);
      expect(period.totalReward).to.equal(amount);
      expect(period.active).to.be.true;
    });

    it("should revert with zero amount", async () => {
      const { dist, admin } = await loadFixture(deployRevenueFixture);
      await expect(
        dist.connect(admin).createPeriod(0, "Zero")
      ).to.be.revertedWith("Distributor: zero amount");
    });

    it("should revert from non-DISTRIBUTOR_ROLE", async () => {
      const { dist, alice } = await loadFixture(deployRevenueFixture);
      await expect(
        dist.connect(alice).createPeriod(100, "X")
      ).to.be.reverted;
    });
  });

  describe("Claim", () => {
    async function setupPeriod() {
      const f = await loadFixture(deployRevenueFixture);
      const TOTAL = ethers.parseUnits("1000", 6); // 1000 USDC
      await f.usdc.connect(f.admin).approve(await f.dist.getAddress(), TOTAL);
      await f.dist.connect(f.admin).createPeriod(TOTAL, "Test Period");
      return { ...f, TOTAL };
    }

    it("alice (60%) should receive 600 USDC", async () => {
      const { usdc, dist, alice, TOTAL } = await setupPeriod();
      const aliceBefore = await usdc.balanceOf(alice.address);
      await dist.connect(alice).claim(0);
      const aliceAfter = await usdc.balanceOf(alice.address);
      // alice has 600/1000 = 60%  →  600 USDC
      expect(aliceAfter - aliceBefore).to.equal(ethers.parseUnits("600", 6));
    });

    it("bob (40%) should receive 400 USDC", async () => {
      const { usdc, dist, bob } = await setupPeriod();
      const bobBefore = await usdc.balanceOf(bob.address);
      await dist.connect(bob).claim(0);
      const bobAfter = await usdc.balanceOf(bob.address);
      expect(bobAfter - bobBefore).to.equal(ethers.parseUnits("400", 6));
    });

    it("should revert on double claim", async () => {
      const { dist, alice } = await setupPeriod();
      await dist.connect(alice).claim(0);
      await expect(dist.connect(alice).claim(0))
        .to.be.revertedWith("Distributor: already claimed");
    });

    it("charlie (0 balance) cannot claim", async () => {
      const { dist, charlie } = await setupPeriod();
      await expect(dist.connect(charlie).claim(0))
        .to.be.revertedWith("Distributor: no balance at snapshot");
    });

    it("total claims should not exceed period total (dust stays in contract)", async () => {
      const { usdc, dist, alice, bob } = await setupPeriod();
      await dist.connect(alice).claim(0);
      await dist.connect(bob).claim(0);
      // 600 + 400 = 1000 USDC claimed exactly (no dust here with round numbers)
      const remaining = await usdc.balanceOf(await dist.getAddress());
      expect(remaining).to.equal(0n);
    });
  });

  describe("claimMultiple", () => {
    it("should claim from two periods in one tx", async () => {
      const { usdc, dist, admin, alice } = await loadFixture(deployRevenueFixture);
      const TOTAL = ethers.parseUnits("1000", 6);

      // Create two periods
      await usdc.connect(admin).approve(await dist.getAddress(), TOTAL * 2n);
      await dist.connect(admin).createPeriod(TOTAL, "Period 1");
      await mine(1);
      await dist.connect(admin).createPeriod(TOTAL, "Period 2");

      const before = await usdc.balanceOf(alice.address);
      await dist.connect(alice).claimMultiple([0, 1]);
      const after = await usdc.balanceOf(alice.address);

      // Alice 60% of 2000 = 1200
      expect(after - before).to.equal(ethers.parseUnits("1200", 6));
    });
  });

  describe("previewClaimable", () => {
    it("should return correct preview amount", async () => {
      const { usdc, dist, admin, alice } = await loadFixture(deployRevenueFixture);
      const TOTAL = ethers.parseUnits("1000", 6);
      await usdc.connect(admin).approve(await dist.getAddress(), TOTAL);
      await dist.connect(admin).createPeriod(TOTAL, "Period 1");

      const [claimable] = await dist.previewClaimable(alice.address);
      expect(claimable).to.equal(ethers.parseUnits("600", 6));
    });
  });

  describe("Admin: period deactivation", () => {
    it("should block claims on deactivated period", async () => {
      const { usdc, dist, admin, alice } = await loadFixture(deployRevenueFixture);
      const TOTAL = ethers.parseUnits("1000", 6);
      await usdc.connect(admin).approve(await dist.getAddress(), TOTAL);
      await dist.connect(admin).createPeriod(TOTAL, "P1");
      await dist.connect(admin).deactivatePeriod(0);

      await expect(dist.connect(alice).claim(0))
        .to.be.revertedWith("Distributor: period not active");
    });
  });
});
