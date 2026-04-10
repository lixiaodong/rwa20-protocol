/**
 * scripts/examples/deployDurian.ts
 * ──────────────────────────────────
 * Example: Launch a tokenized Agriculture asset (Musang King Durian Farm)
 *
 * Asset:        Musang King Durian Farm, Raub, Pahang, Malaysia
 * Structure:    SPV: Raub Durian Holdings Sdn Bhd
 * Jurisdiction: MY (Malaysia) — open to global investors (no compliance)
 * Yield:        ~18% annual (high risk, harvest-dependent)
 * Token:        DURIAN — 500,000 tokens @ bonding curve
 * Compliance:   None (freely tradable — retail friendly)
 * Duration:     5-year harvest cycle (trees take 3–5 years to bear fruit)
 *
 * Oracle model (agriculture-specific):
 *   → Pre-season: update with estimated yield
 *   → Post-harvest: update with actual crop output + proceeds
 *   → Revenue period created per harvest
 *
 * Usage:
 *   npx hardhat run scripts/examples/deployDurian.ts --network localhost
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses  = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../deployed-addresses.json"), "utf8")
  );

  console.log("═══════════════════════════════════════════════════");
  console.log("  RWA20 — Agriculture Asset Example");
  console.log("  Musang King Durian Farm, Raub, Pahang, Malaysia");
  console.log("═══════════════════════════════════════════════════\n");

  const launchpad = await ethers.getContractAt("RWALaunchpad", addresses.launchpad);
  const usdc      = await ethers.getContractAt("MockUSDC",     addresses.usdc);

  // ── Fund for launch fee ────────────────────────────────────────────────────
  await usdc.faucet();
  await usdc.approve(addresses.launchpad, ethers.parseUnits("100", 6));

  const agreementHash = ethers.keccak256(
    ethers.toUtf8Bytes("ipfs://Qm_DURIAN_FARM_AGREEMENT_RAUB_2025")
  );

  // ── Launch config: Agriculture, no compliance, bonding curve ──────────────
  const launchConfig = {
    name:     "Musang King Durian Token",
    symbol:   "DURIAN",
    assetType: 1,           // AGRICULTURE
    assetId:   "AG-MY-DURIAN-RAUB-001",
    legalInfo: {
      spvName:      "Raub Durian Holdings Sdn Bhd",
      jurisdiction: "MY",
      agreementHash,
    },
    useCompliance:  false,  // Open to global retail investors
    initialSupply:  ethers.parseEther("0"),
    // Bonding curve: 500,000 tokens, starting at $0.20 per token
    fundingTarget:  ethers.parseUnits("100000", 6),  // $100,000 USDC target
    curveMaxTokens: ethers.parseEther("500000"),      // 500k tokens
    bondingBasePrice: ethers.parseUnits("0.2", 18),  // $0.20 floor
    bondingSlope:     ethers.parseUnits("0.00000002", 18), // slight incline
  };

  console.log("🌳 Launching Durian Farm token...");
  const tx      = await launchpad.launch(launchConfig);
  const receipt = await tx.wait();

  const event = receipt!.logs.find(
    (log: any) => log.fragment?.name === "AssetLaunched"
  ) as any;

  const assetIndex   = event?.args?.assetIndex;
  const tokenAddress = event?.args?.token;
  const curveAddress = event?.args?.bondingCurve;

  console.log(`\n✅ Durian Farm asset launched!`);
  console.log(`   Asset Index:   ${assetIndex}`);
  console.log(`   Token:         ${tokenAddress}`);
  console.log(`   Bonding Curve: ${curveAddress}`);

  const asset       = await launchpad.getAsset(assetIndex);
  const oracle      = await ethers.getContractAt("AssetOracle", asset.oracle);
  const distributor = await ethers.getContractAt("RevenueDistributor", asset.distributor);

  // ── Push oracle data: pre-season estimate ─────────────────────────────────
  console.log("\n🌳 Pushing pre-season oracle data (Harvest Season 2025)...");
  const seasonStart  = Math.floor(Date.now() / 1000);
  const harvestEnd   = seasonStart + 180 * 24 * 3600; // 6-month harvest window

  await oracle.updateData(
    ethers.parseEther("1000000"),  // Estimated farm NAV: $1,000,000
    1800,                           // 18.00% annual yield (1800 bps)
    seasonStart,
    harvestEnd,
    "ipfs://Qm_DURIAN_HARVEST_2025_PRE_SEASON_ESTIMATE"
  );

  console.log(`   Estimated NAV: $1,000,000`);
  console.log(`   Estimated Yield: 18.00% / year`);
  console.log(`   Harvest Window: ${new Date(seasonStart * 1000).toISOString()} → ${new Date(harvestEnd * 1000).toISOString()}`);

  // ── Simulate: 100 investors each buy 1000 tokens via bonding curve ─────────
  console.log("\n🛒 Simulating investor purchases via bonding curve...");
  const curve   = await ethers.getContractAt("BondingCurve", curveAddress);
  const buyAmt  = ethers.parseEther("1000"); // 1000 tokens
  const cost    = await curve.quoteBuy(buyAmt);
  console.log(`   Cost for 1,000 tokens: ${ethers.formatUnits(cost, 6)} USDC`);

  // Deployer buys as demo
  await usdc.mint(deployer.address, ethers.parseUnits("1000", 6));
  await usdc.approve(curveAddress, ethers.parseUnits("1000", 6));
  await curve.buy(buyAmt);
  console.log(`   Deployer purchased 1,000 DURIAN tokens`);
  console.log(`   Deployer balance: ${ethers.formatEther(await ethers.getContractAt("RWA20Token", asset.token).then(t => t.balanceOf(deployer.address)))} DURIAN`);

  // ── Post-harvest oracle update + revenue distribution ─────────────────────
  console.log("\n🍂 Simulating post-harvest oracle update...");
  await oracle.updateData(
    ethers.parseEther("1200000"),  // Actual NAV after harvest: $1.2M (good season)
    2200,                           // Actual yield: 22% (above estimate)
    seasonStart,
    harvestEnd,
    "ipfs://Qm_DURIAN_HARVEST_2025_ACTUAL_RESULTS"
  );
  console.log("   Oracle updated: Yield 22% (great harvest!)");

  // ── Create harvest revenue period ─────────────────────────────────────────
  const HARVEST_PROCEEDS = ethers.parseUnits("50000", 6); // $50,000 USDC after costs
  await usdc.mint(deployer.address, HARVEST_PROCEEDS);
  await usdc.approve(asset.distributor, HARVEST_PROCEEDS);

  console.log("\n💰 Creating harvest revenue period ($50,000 USDC)...");
  await distributor.createPeriod(HARVEST_PROCEEDS, "Musang King Harvest 2025 — Raub Farm");

  // ── Show claimable for deployer ────────────────────────────────────────────
  const [claimable] = await distributor.previewClaimable(deployer.address);
  console.log(`\n   Deployer claimable: ${ethers.formatUnits(claimable, 6)} USDC`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Durian Farm Asset Setup Complete!");
  console.log("═══════════════════════════════════════════════════");

  const example = {
    name:    "Musang King Durian Token",
    symbol:  "DURIAN",
    assetId: "AG-MY-DURIAN-RAUB-001",
    ...asset,
    assetIndex: assetIndex.toString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "../../deployed-durian.json"),
    JSON.stringify(example, null, 2)
  );
  console.log("\n  Saved to deployed-durian.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
