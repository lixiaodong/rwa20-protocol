/**
 * scripts/examples/deployRealEstate.ts
 * ─────────────────────────────────────
 * Example: Launch a tokenized Real Estate asset (KL Tower Office Block)
 *
 * Asset:        KL Tower Grade-A Office, Kuala Lumpur, Malaysia
 * Structure:    SPV: KL Tower Realty Sdn Bhd
 * Jurisdiction: MY (Malaysia)
 * Yield:        6.5% annual rental yield
 * Token:        KLTO — 1,000,000 tokens @ 1 token = 1 USD NAV floor
 * Compliance:   KYC required (accredited investors only)
 * Duration:     5-year hold
 *
 * Usage:
 *   npx hardhat run scripts/examples/deployRealEstate.ts --network localhost
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, investor1, investor2] = await ethers.getSigners();
  const addresses = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../deployed-addresses.json"), "utf8")
  );

  console.log("═══════════════════════════════════════════════════");
  console.log("  RWA20 — Real Estate Asset Example");
  console.log("  KL Tower Grade-A Office, Kuala Lumpur");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Get deployed contracts ─────────────────────────────────────────────────
  const launchpad = await ethers.getContractAt("RWALaunchpad", addresses.launchpad);
  const usdc      = await ethers.getContractAt("MockUSDC",     addresses.usdc);

  // ── Fund deployer with USDC for launch fee ─────────────────────────────────
  console.log("💵 Getting USDC for launch fee...");
  await usdc.faucet();
  await usdc.approve(addresses.launchpad, ethers.parseUnits("100", 6));

  // ── Agreement hash (in production: keccak256 of IPFS CID) ─────────────────
  const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://Qm_KL_TOWER_LEGAL_AGREEMENT"));

  // ── Launch configuration ───────────────────────────────────────────────────
  const launchConfig = {
    name:          "KL Tower Office Token",
    symbol:        "KLTO",
    assetType:     0, // REAL_ESTATE
    assetId:       "RE-MY-KL-TOWER-001",
    legalInfo: {
      spvName:       "KL Tower Realty Sdn Bhd",
      jurisdiction:  "MY",
      agreementHash: agreementHash,
    },
    useCompliance: true,   // Require KYC for real estate
    initialSupply: ethers.parseEther("0"),          // No immediate mint — use bonding curve
    fundingTarget: ethers.parseUnits("500000", 6),  // $500,000 USDC funding target
    curveMaxTokens:ethers.parseEther("1000000"),    // 1,000,000 tokens for sale
    bondingBasePrice: ethers.parseUnits("0.5", 18), // $0.50 floor price per token
    bondingSlope:     ethers.parseUnits("0.0000001", 18), // tiny slope
  };

  console.log("🚀 Launching Real Estate token...");
  const tx         = await launchpad.launch(launchConfig);
  const receipt    = await tx.wait();

  // Parse the AssetLaunched event
  const event = receipt!.logs.find(
    (log: any) => log.fragment?.name === "AssetLaunched"
  ) as any;

  const assetIndex    = event?.args?.assetIndex;
  const tokenAddress  = event?.args?.token;
  const curveAddress  = event?.args?.bondingCurve;

  console.log(`\n✅ Asset launched!`);
  console.log(`   Asset Index:   ${assetIndex}`);
  console.log(`   Token:         ${tokenAddress}`);
  console.log(`   Bonding Curve: ${curveAddress}`);

  // ── Get deployed sub-contracts ─────────────────────────────────────────────
  const asset      = await launchpad.getAsset(assetIndex);
  const token      = await ethers.getContractAt("RWA20Token",       asset.token);
  const compliance = await ethers.getContractAt("BasicCompliance",  asset.compliance);
  const oracle     = await ethers.getContractAt("AssetOracle",      asset.oracle);
  const distributor = await ethers.getContractAt("RevenueDistributor", asset.distributor);

  // ── Set up compliance: allow Malaysia & Singapore investors ───────────────
  console.log("\n🔐 Configuring compliance (KYC + jurisdictions)...");
  await compliance.batchSetJurisdictions(["MY", "SG", "US"], [true, true, true]);

  // Whitelist deployer as accredited investor
  await compliance.setInvestor(
    deployer.address,
    true,             // approved
    2,                // ACCREDITED
    "MY",
    0                 // no limit
  );

  // Whitelist test investor 1
  if (investor1) {
    await compliance.setInvestor(investor1.address, true, 2, "MY", 0);
    console.log(`   Investor 1 (${investor1.address}) approved`);
  }

  console.log("   Jurisdictions: MY, SG, US ✅");

  // ── Push initial oracle data ───────────────────────────────────────────────
  console.log("\n📊 Pushing oracle data...");
  const now     = Math.floor(Date.now() / 1000);
  const yearEnd = now + 365 * 24 * 3600;

  await oracle.updateData(
    ethers.parseEther("5000000"),  // NAV: $5,000,000
    650,                            // 6.50% annual yield (650 bps)
    now,
    yearEnd,
    "ipfs://Qm_KLTO_RENTAL_REPORT_2025_Q1"
  );

  console.log(`   NAV:   $5,000,000`);
  console.log(`   Yield: 6.50% / year`);

  // ── Simulate first revenue distribution (Q1 rental income) ────────────────
  // In production, skip this — wait for actual rental income
  const Q1_RENTAL = ethers.parseUnits("81250", 6); // ~$81,250 = 6.5% of $5M / 4

  // Give distributor role to deployer and approve USDC
  await usdc.mint(deployer.address, Q1_RENTAL);
  await usdc.approve(asset.distributor, Q1_RENTAL);

  console.log("\n💰 Creating Q1 revenue period ($81,250 USDC)...");
  // Note: To use this distributor needs DISTRIBUTOR_ROLE granted to deployer
  // (already set by factory/constructor)
  await distributor.createPeriod(Q1_RENTAL, "Q1 2025 Rental Income — KL Tower");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Real Estate Asset Setup Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log({
    token:       asset.token,
    compliance:  asset.compliance,
    oracle:      asset.oracle,
    distributor: asset.distributor,
    wrapper:     asset.wrapper,
    bondingCurve: asset.bondingCurve,
  });

  // Save for frontend
  const example = {
    name:    "KL Tower Office Token",
    symbol:  "KLTO",
    assetId: "RE-MY-KL-TOWER-001",
    ...asset,
    assetIndex: assetIndex.toString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "../../deployed-real-estate.json"),
    JSON.stringify(example, null, 2)
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
