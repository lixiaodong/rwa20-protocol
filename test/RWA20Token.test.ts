import { expect }        from "chai";
import { ethers }        from "hardhat";
import { loadFixture }   from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type {
  RWA20Token,
  NoCompliance,
  BasicCompliance,
} from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const AssetType = { REAL_ESTATE: 0, AGRICULTURE: 1, GOLD: 2, DEBT: 3 };

const defaultLegalInfo = {
  spvName:       "Test SPV Ltd",
  jurisdiction:  "MY",
  agreementHash: ethers.ZeroHash,
};

async function deployNoComplianceToken() {
  const [admin, alice, bob, charlie] = await ethers.getSigners();

  const NoComp = await ethers.getContractFactory("NoCompliance");
  const noComp = await NoComp.deploy() as NoCompliance;

  const Token  = await ethers.getContractFactory("RWA20Token");
  const token  = await Token.deploy(
    "Durian Farm Token",
    "DURIAN",
    18,
    AssetType.AGRICULTURE,
    "AG-MY-DURIAN-001",
    defaultLegalInfo,
    admin.address,
    await noComp.getAddress()
  ) as RWA20Token;

  return { token, noComp, admin, alice, bob, charlie };
}

async function deployCompliantToken() {
  const [admin, alice, bob] = await ethers.getSigners();

  const BasicComp = await ethers.getContractFactory("BasicCompliance");
  const compliance = await BasicComp.deploy(admin.address) as BasicCompliance;

  const Token  = await ethers.getContractFactory("RWA20Token");
  const token  = await Token.deploy(
    "KL Tower Token",
    "KLTO",
    18,
    AssetType.REAL_ESTATE,
    "RE-MY-KLTO-001",
    defaultLegalInfo,
    admin.address,
    await compliance.getAddress()
  ) as RWA20Token;

  return { token, compliance, admin, alice, bob };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RWA20Token", () => {

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe("Metadata", () => {
    it("should expose correct asset type and id", async () => {
      const { token } = await loadFixture(deployNoComplianceToken);
      expect(await token.assetType()).to.equal(AssetType.AGRICULTURE);
      expect(await token.assetId()).to.equal("AG-MY-DURIAN-001");
    });

    it("should store legal info", async () => {
      const { token } = await loadFixture(deployNoComplianceToken);
      const info = await token.legalInfo();
      expect(info.spvName).to.equal("Test SPV Ltd");
      expect(info.jurisdiction).to.equal("MY");
    });

    it("should allow admin to update legal info", async () => {
      const { token, admin } = await loadFixture(deployNoComplianceToken);
      const newHash = ethers.keccak256(ethers.toUtf8Bytes("new-agreement"));
      await token.connect(admin).updateLegalInfo({
        spvName:       "Updated SPV",
        jurisdiction:  "SG",
        agreementHash: newHash,
      });
      const info = await token.legalInfo();
      expect(info.spvName).to.equal("Updated SPV");
    });

    it("should revert non-admin legal info update", async () => {
      const { token, alice } = await loadFixture(deployNoComplianceToken);
      await expect(
        token.connect(alice).updateLegalInfo(defaultLegalInfo)
      ).to.be.reverted;
    });
  });

  // ── Minting ───────────────────────────────────────────────────────────────

  describe("Minting", () => {
    it("should mint to recipient", async () => {
      const { token, admin, alice } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("1000"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should revert mint from non-MINTER_ROLE", async () => {
      const { token, alice } = await loadFixture(deployNoComplianceToken);
      await expect(
        token.connect(alice).mint(alice.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });

    it("should auto-delegate on first mint for ERC20Votes", async () => {
      const { token, admin, alice } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("500"));
      // Auto-delegation means alice's votes = her balance
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("500"));
    });

    it("should allow self-burn", async () => {
      const { token, admin, alice } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(alice).burnSelf(ethers.parseEther("50"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));
    });
  });

  // ── Transfers: NoCompliance ───────────────────────────────────────────────

  describe("Transfers (NoCompliance)", () => {
    it("should allow any transfer", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(alice).transfer(bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("50"));
    });

    it("should transfer full amount", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("1000"));
      await token.connect(alice).transfer(bob.address, ethers.parseEther("1000"));
      expect(await token.balanceOf(alice.address)).to.equal(0n);
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("1000"));
    });
  });

  // ── Transfers: BasicCompliance ────────────────────────────────────────────

  describe("Transfers (BasicCompliance)", () => {
    it("should block transfer when sender not KYC'd", async () => {
      const { token, compliance, admin, alice, bob } =
        await loadFixture(deployCompliantToken);

      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      // Alice not approved
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Compliance: sender not KYC approved");
    });

    it("should block transfer when receiver not KYC'd", async () => {
      const { token, compliance, admin, alice, bob } =
        await loadFixture(deployCompliantToken);

      // Approve alice, not bob
      await compliance.connect(admin).setInvestor(alice.address, true, 2, "MY", 0);
      // Allow MY jurisdiction
      await compliance.connect(admin).setJurisdiction("MY", true);

      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Compliance: receiver not KYC approved");
    });

    it("should allow transfer when both parties KYC'd in allowed jurisdiction", async () => {
      const { token, compliance, admin, alice, bob } =
        await loadFixture(deployCompliantToken);

      await compliance.connect(admin).setJurisdiction("MY", true);
      await compliance.connect(admin).setInvestor(alice.address, true, 2, "MY", 0);
      await compliance.connect(admin).setInvestor(bob.address,   true, 2, "MY", 0);

      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(alice).transfer(bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("50"));
    });

    it("should block transfer from blocked jurisdiction", async () => {
      const { token, compliance, admin, alice, bob } =
        await loadFixture(deployCompliantToken);

      // MY allowed but DPRK not set → defaults to false
      await compliance.connect(admin).setJurisdiction("MY", true);
      await compliance.connect(admin).setInvestor(alice.address, true, 2, "DPRK", 0);
      await compliance.connect(admin).setInvestor(bob.address,   true, 2, "MY",   0);

      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Compliance: sender jurisdiction not allowed");
    });

    it("should enforce per-investor transfer limit", async () => {
      const { token, compliance, admin, alice, bob } =
        await loadFixture(deployCompliantToken);

      await compliance.connect(admin).setJurisdiction("MY", true);
      const LIMIT = ethers.parseEther("100");
      await compliance.connect(admin).setInvestor(alice.address, true, 2, "MY", LIMIT);
      await compliance.connect(admin).setInvestor(bob.address,   true, 2, "MY", 0);

      await token.connect(admin).mint(alice.address, ethers.parseEther("1000"));
      // Over limit
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("101"))
      ).to.be.revertedWith("Compliance: sender transfer limit exceeded");
      // At limit — ok
      await token.connect(alice).transfer(bob.address, LIMIT);
    });

    it("should allow switching compliance module to NoCompliance", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployCompliantToken);

      const NoComp = await ethers.getContractFactory("NoCompliance");
      const noComp = await NoComp.deploy();
      await token.connect(admin).setComplianceModule(await noComp.getAddress());

      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(alice).transfer(bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("50"));
    });
  });

  // ── Pause ─────────────────────────────────────────────────────────────────

  describe("Pause", () => {
    it("should block transfers when paused", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(admin).pause();
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("10"))
      ).to.be.reverted;
    });

    it("should allow transfers after unpause", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("100"));
      await token.connect(admin).pause();
      await token.connect(admin).unpause();
      await token.connect(alice).transfer(bob.address, ethers.parseEther("10"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("10"));
    });
  });

  // ── ERC20Votes ────────────────────────────────────────────────────────────

  describe("ERC20Votes", () => {
    it("should checkpoint voting power on transfer", async () => {
      const { token, admin, alice, bob } = await loadFixture(deployNoComplianceToken);
      await token.connect(admin).mint(alice.address, ethers.parseEther("600"));
      await token.connect(admin).mint(bob.address,   ethers.parseEther("400"));

      const blockBefore = await ethers.provider.getBlockNumber();

      // Mine a block
      await ethers.provider.send("evm_mine", []);

      expect(await token.getPastVotes(alice.address, blockBefore)).to.equal(
        ethers.parseEther("600")
      );
      expect(await token.getPastVotes(bob.address, blockBefore)).to.equal(
        ethers.parseEther("400")
      );
    });
  });
});
