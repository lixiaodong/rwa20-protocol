/**
 * scripts/deploy.ts
 * ─────────────────
 * Deploy the core RWA20 protocol infrastructure:
 *   1. MockUSDC         (test only — skip on mainnet)
 *   2. RWA20Factory
 *   3. RWALaunchpad
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network localhost
 *   npx hardhat run scripts/deploy.ts --network sepolia
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PRODUCTION_USDC: Record<number, string> = {
  1:       "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum Mainnet
  137:     "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon
  80001:   "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23", // Mumbai (old)
  80002:   "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Amoy
  11155111:"0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia Circle USDC
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = (await ethers.provider.getNetwork()).chainId;
  const isTestnet  = chainId === 31337n || chainId === 11155111n || chainId === 80002n;

  console.log("═══════════════════════════════════════════════════");
  console.log("  RWA20 Protocol — Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log("  Network:  ", network.name, `(chainId: ${chainId})`);
  console.log("  Deployer: ", deployer.address);
  console.log("  Balance:  ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("───────────────────────────────────────────────────\n");

  // ── 1. USDC ────────────────────────────────────────────────────────────────
  let usdcAddress: string;
  if (isTestnet || chainId === 31337n) {
    console.log("📦 Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc     = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log(`   MockUSDC deployed at: ${usdcAddress}`);
  } else {
    usdcAddress = PRODUCTION_USDC[Number(chainId)];
    if (!usdcAddress) throw new Error(`No USDC address for chainId ${chainId}. Set in deploy.ts.`);
    console.log(`💵 Using production USDC: ${usdcAddress}`);
  }

  // ── 2. RWA20Factory ────────────────────────────────────────────────────────
  console.log("\n📦 Deploying RWA20Factory...");
  const Factory  = await ethers.getContractFactory("RWA20Factory");
  const factory  = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`   RWA20Factory deployed at: ${factoryAddress}`);

  // ── 3. RWALaunchpad ────────────────────────────────────────────────────────
  console.log("\n📦 Deploying RWALaunchpad...");
  const LAUNCH_FEE = ethers.parseUnits("10", 6); // $10 USDC launch fee
  const Launchpad  = await ethers.getContractFactory("RWALaunchpad");
  const launchpad  = await Launchpad.deploy(factoryAddress, usdcAddress, LAUNCH_FEE);
  await launchpad.waitForDeployment();
  const launchpadAddress = await launchpad.getAddress();
  console.log(`   RWALaunchpad deployed at: ${launchpadAddress}`);

  // ── 4. Save addresses ──────────────────────────────────────────────────────
  const deployedAddresses = {
    network:    network.name,
    chainId:    chainId.toString(),
    deployer:   deployer.address,
    timestamp:  new Date().toISOString(),
    usdc:       usdcAddress,
    factory:    factoryAddress,
    launchpad:  launchpadAddress,
  };

  const outPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(deployedAddresses, null, 2));

  // Also write to frontend lib for easy import
  const frontendPath = path.join(__dirname, "../frontend/lib/deployedAddresses.json");
  if (fs.existsSync(path.dirname(frontendPath))) {
    fs.writeFileSync(frontendPath, JSON.stringify(deployedAddresses, null, 2));
    console.log("\n✅ Frontend addresses updated:", frontendPath);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(JSON.stringify(deployedAddresses, null, 2));
  console.log("\n  Saved to:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
