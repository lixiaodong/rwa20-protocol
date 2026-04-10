/**
 * lib/contracts.ts
 * Contract addresses + ABIs for the RWA20 protocol
 * Addresses are loaded from deployed-addresses.json (written by deploy script)
 */

// ── Addresses ─────────────────────────────────────────────────────────────────

// These are updated automatically by scripts/deploy.ts
// For local dev, run: npx hardhat node && npx hardhat run scripts/deploy.ts --network localhost
export const CONTRACTS = {
  // Replace with your deployed addresses:
  LAUNCHPAD: (process.env.NEXT_PUBLIC_LAUNCHPAD  ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  FACTORY:   (process.env.NEXT_PUBLIC_FACTORY    ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  USDC:      (process.env.NEXT_PUBLIC_USDC       ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

// ── ABIs ──────────────────────────────────────────────────────────────────────

export const LAUNCHPAD_ABI = [
  // View
  { name: "assetCount",     type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "getAsset",       type: "function", stateMutability: "view",       inputs: [{ name: "idx", type: "uint256" }],               outputs: [{ name: "", type: "tuple", components: [{ name: "issuer", type: "address" }, { name: "token", type: "address" }, { name: "compliance", type: "address" }, { name: "oracle", type: "address" }, { name: "distributor", type: "address" }, { name: "wrapper", type: "address" }, { name: "bondingCurve", type: "address" }, { name: "launchedAt", type: "uint256" }, { name: "active", type: "bool" }, { name: "assetType", type: "uint8" }, { name: "assetId", type: "string" }] }] },
  { name: "getAllAssets",    type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ name: "", type: "tuple[]", components: [{ name: "issuer", type: "address" }, { name: "token", type: "address" }, { name: "compliance", type: "address" }, { name: "oracle", type: "address" }, { name: "distributor", type: "address" }, { name: "wrapper", type: "address" }, { name: "bondingCurve", type: "address" }, { name: "launchedAt", type: "uint256" }, { name: "active", type: "bool" }, { name: "assetType", type: "uint8" }, { name: "assetId", type: "string" }] }] },
  { name: "getIssuerAssets", type: "function", stateMutability: "view",      inputs: [{ name: "issuer", type: "address" }],            outputs: [{ type: "uint256[]" }] },
  { name: "launchFee",       type: "function", stateMutability: "view",      inputs: [],                                              outputs: [{ type: "uint256" }] },
  // Write
  {
    name:             "launch",
    type:             "function",
    stateMutability:  "nonpayable",
    inputs: [{
      name: "cfg",
      type: "tuple",
      components: [
        { name: "name",             type: "string"  },
        { name: "symbol",           type: "string"  },
        { name: "assetType",        type: "uint8"   },
        { name: "assetId",          type: "string"  },
        { name: "legalInfo", type: "tuple", components: [
          { name: "spvName",       type: "string"  },
          { name: "jurisdiction",  type: "string"  },
          { name: "agreementHash", type: "bytes32" },
        ]},
        { name: "useCompliance",    type: "bool"    },
        { name: "initialSupply",    type: "uint256" },
        { name: "fundingTarget",    type: "uint256" },
        { name: "curveMaxTokens",   type: "uint256" },
        { name: "bondingBasePrice", type: "uint256" },
        { name: "bondingSlope",     type: "uint256" },
      ],
    }],
    outputs: [{ name: "assetIndex", type: "uint256" }],
  },
  // Events
  { name: "AssetLaunched", type: "event", inputs: [{ name: "assetIndex", type: "uint256", indexed: true }, { name: "issuer", type: "address", indexed: true }, { name: "token", type: "address", indexed: true }, { name: "bondingCurve", type: "address" }, { name: "assetType", type: "uint8" }, { name: "assetId", type: "string" }] },
] as const;

export const ERC20_ABI = [
  { name: "name",        type: "function", stateMutability: "view",       inputs: [],                                                          outputs: [{ type: "string" }] },
  { name: "symbol",      type: "function", stateMutability: "view",       inputs: [],                                                          outputs: [{ type: "string" }] },
  { name: "decimals",    type: "function", stateMutability: "view",       inputs: [],                                                          outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view",       inputs: [],                                                          outputs: [{ type: "uint256" }] },
  { name: "balanceOf",   type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }],                        outputs: [{ type: "uint256" }] },
  { name: "allowance",   type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "transfer",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],     outputs: [{ type: "bool" }] },
  { name: "faucet",      type: "function", stateMutability: "nonpayable", inputs: [],                                                          outputs: [] },
] as const;

export const RWA20_ABI = [
  ...ERC20_ABI,
  { name: "assetType",        type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "assetId",          type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "complianceModule", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "oracle",           type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "legalInfo",        type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "tuple", components: [{ name: "spvName", type: "string" }, { name: "jurisdiction", type: "string" }, { name: "agreementHash", type: "bytes32" }] }] },
] as const;

export const ORACLE_ABI = [
  { name: "data", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "tuple", components: [{ name: "navUSD", type: "uint256" }, { name: "annualYieldBps", type: "uint256" }, { name: "yieldPeriodStart", type: "uint256" }, { name: "yieldPeriodEnd", type: "uint256" }, { name: "yieldMetadata", type: "string" }, { name: "updatedAt", type: "uint256" }, { name: "updatedBy", type: "address" }] }] },
  { name: "getNAV",      type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getYieldBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const DISTRIBUTOR_ABI = [
  { name: "periodCount",       type: "function", stateMutability: "view",       inputs: [],                                                              outputs: [{ type: "uint256" }] },
  { name: "periods",           type: "function", stateMutability: "view",       inputs: [{ name: "", type: "uint256" }],                                 outputs: [{ name: "", type: "tuple", components: [{ name: "snapshotBlock", type: "uint256" }, { name: "totalReward", type: "uint256" }, { name: "totalSupply", type: "uint256" }, { name: "createdAt", type: "uint256" }, { name: "active", type: "bool" }, { name: "description", type: "string" }] }] },
  { name: "claimed",           type: "function", stateMutability: "view",       inputs: [{ name: "periodId", type: "uint256" }, { name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "previewClaimable",  type: "function", stateMutability: "view",       inputs: [{ name: "user", type: "address" }],                             outputs: [{ name: "total", type: "uint256" }, { name: "claimablePeriods", type: "uint256[]" }] },
  { name: "claim",             type: "function", stateMutability: "nonpayable", inputs: [{ name: "periodId", type: "uint256" }],                         outputs: [] },
  { name: "claimMultiple",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "periodIds", type: "uint256[]" }],                      outputs: [] },
  { name: "createPeriod",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "description", type: "string" }], outputs: [] },
] as const;

export const BONDING_CURVE_ABI = [
  { name: "currentPrice",    type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "quoteBuy",        type: "function", stateMutability: "view",       inputs: [{ name: "amount", type: "uint256" }],           outputs: [{ name: "cost", type: "uint256" }] },
  { name: "tokensSold",      type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "fundsRaised",     type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "fundingTarget",   type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "maxTokens",       type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "progressBps",     type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint256" }] },
  { name: "status",          type: "function", stateMutability: "view",       inputs: [],                                              outputs: [{ type: "uint8" }] },
  { name: "buy",             type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }],           outputs: [] },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const ASSET_TYPES = ["Real Estate", "Agriculture", "Gold", "Debt"] as const;

export function formatUSDC(raw: bigint, decimals = 6): string {
  return (Number(raw) / 10 ** decimals).toLocaleString("en-US", {
    style:    "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatToken(raw: bigint, decimals = 18): string {
  return (Number(raw) / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
