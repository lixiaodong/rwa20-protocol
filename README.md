# RWA20 Protocol

> **One-click tokenization of real-world assets** — Real Estate · Agriculture · Gold · Debt

RWA20 is a modular, production-ready smart contract protocol for issuing, trading, and distributing revenue from tokenized real-world assets. Think **pump.fun**, but for tangible assets like durian farms and office buildings.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          RWALaunchpad                               │
│   One-click deploy: token + compliance + oracle + revenue + wrapper │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ deploys via
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RWA20Factory                                │
└──┬──────────┬────────────┬──────────────┬───────────────────────────┘
   │          │            │              │
   ▼          ▼            ▼              ▼
RWA20Token  Compliance  AssetOracle  RevenueDistributor   WRWA20
   │            │            │              │                │
   │         ┌──┴───┐     NAV/Yield   Snapshot USDC      1:1 DEX
   │         │      │     updates     distribution       wrapper
   │    BasicComp NoComp
   │    (KYC)    (Open)
   │
   └── ERC20 + ERC20Votes + ERC20Permit + AccessControl + Pausable
```

---

## Contract Reference

### `IRWA20` — Token Interface

The canonical interface all RWA20 tokens implement. Extends ERC-20 with:

| Field | Type | Description |
|-------|------|-------------|
| `assetType` | `enum AssetType` | REAL_ESTATE / AGRICULTURE / GOLD / DEBT |
| `assetId` | `string` | Off-chain asset identifier (e.g. "RE-MY-KL-001") |
| `legalInfo` | `LegalInfo` | SPV name, jurisdiction, agreement hash |
| `custodyInfo` | `CustodyInfo` | Custodian address, audit proof hash, timestamp |
| `complianceModule` | `address` | Pluggable compliance contract |
| `oracle` | `address` | Asset valuation oracle |

### `RWA20Token` — Core Token

Full-featured ERC-20 token with:
- **ERC20Votes** for snapshot-based revenue distribution
- **ERC20Permit** for gasless approvals (EIP-2612)
- **AccessControl** with MINTER / PAUSER / ORACLE / ADMIN roles
- **Pausable** for emergency stops
- **Auto-delegation** on first mint (enables revenue snapshots without user action)

```solidity
// Compliance check happens in _update() hook
function _update(address from, address to, uint256 amount) internal override {
    if (complianceModule != address(0) && from != address(0)) {
        (bool ok, string memory reason) = IComplianceModule(complianceModule).canTransfer(from, to, amount);
        require(ok, reason);
    }
    super._update(from, to, amount);
}
```

### `IComplianceModule` — Pluggable Compliance Interface

```solidity
interface IComplianceModule {
    function canTransfer(address from, address to, uint256 amount)
        external view returns (bool allowed, string memory reason);
    function onTransfer(address from, address to, uint256 amount) external;
}
```

Two implementations are provided:

| Contract | Behavior |
|----------|----------|
| `NoCompliance` | Always allows — for open/retail trading |
| `BasicCompliance` | KYC whitelist + jurisdiction + investor tier + transfer limits |

Switch compliance at any time via `token.setComplianceModule(newModule)`.

### `BasicCompliance` — Full KYC Module

| Feature | Detail |
|---------|--------|
| KYC whitelist | `approved: bool` per address |
| Investor tiers | `NONE / RETAIL / ACCREDITED` |
| Jurisdiction | ISO 3166-1 alpha-2 codes (e.g. "MY", "SG", "US") |
| Transfer limits | Per-investor max per-transaction amount |
| Emergency pause | Blocks all transfers instantly |
| Batch operations | `batchSetInvestors()` for gas-efficient onboarding |

### `AssetOracle` — Valuation & Yield Data

Role-restricted oracle updated by the issuer or an authorized oracle feed:

```solidity
struct AssetData {
    uint256 navUSD;           // Net asset value (18 decimals)
    uint256 annualYieldBps;   // Annual yield in basis points (800 = 8%)
    uint256 yieldPeriodStart; // Harvest/rental period start
    uint256 yieldPeriodEnd;   // Harvest/rental period end
    string  yieldMetadata;    // IPFS CID of rent roll / crop report
    uint256 updatedAt;
    address updatedBy;
}
```

**Agriculture model** (durian farm):
1. Pre-season: push estimated NAV + yield forecast
2. During harvest: update with crop output metadata
3. Post-harvest: update actual yield; trigger `RevenueDistributor.createPeriod()`

**Real estate model**:
1. Monthly/quarterly: update rental income data
2. Annual: update NAV from property valuation

### `RevenueDistributor` — Snapshot USDC Payouts

```
Admin calls createPeriod(amount)
    → Pulls USDC from caller
    → Snapshots total supply at current block - 1
    → Records period: { snapshotBlock, totalReward, totalSupply }

Holders call claim(periodId) or claimMultiple([1,2,3])
    → Checks getPastVotes(user, snapshotBlock)
    → Transfers: (userBalance / totalSupply) × totalReward USDC
```

**Key design decision**: Uses `ERC20Votes.getPastVotes()` instead of iterating all holders. O(1) per claim, no loop gas bomb.

### `WRWA20` — DEX Wrapper

Compliance-restricted RWA20 tokens can't be freely traded on Uniswap/Curve. WRWA20 solves this:

```
wrap(amount)   →  Transfer RWA20 to this contract; mint equal wRWA20
unwrap(amount) →  Burn wRWA20; transfer equal RWA20 to caller
```

1 wRWA20 == 1 RWA20 at all times. Use wRWA20 for:
- DEX liquidity pools
- Collateral in DeFi protocols
- Free peer-to-peer trading

### `BondingCurve` — Fundraising Pricing

Linear bonding curve: `price(n) = basePrice + (slope × tokensSold) / 1e18`

```
cost to buy n tokens = n × basePrice + slope × (2×sold + n) × n / (2×1e18)
```

Example configuration (agriculture crowdfund):
- `basePrice = 0.20 USDC/token`
- `slope = 0.00000002 × 1e18` (tiny price increase)
- `fundingTarget = 100,000 USDC`
- `maxTokens = 500,000`

### `RWALaunchpad` — One-Click Deploy

Single `launch(LaunchConfig cfg)` call deploys:
1. `RWA20Token`
2. `BasicCompliance` or `NoCompliance`
3. `AssetOracle`
4. `RevenueDistributor`
5. `WRWA20`
6. `BondingCurve` (optional, if `fundingTarget > 0`)

Collects a configurable launch fee in USDC.

---

## Real Asset Templates

### 🏢 Real Estate (KL Tower Office)

```
Asset:         Grade-A Office, Kuala Lumpur Tower
SPV:           KL Tower Realty Sdn Bhd
Jurisdiction:  MY
Token:         KLTO — 1,000,000 tokens
Compliance:    BasicCompliance (accredited investors only)
Yield:         6.5% annual rental yield
Distribution:  Quarterly USDC distributions
Duration:      5-year hold
Bonding Curve: $0.50 floor, $500,000 funding target
```

```bash
npx hardhat run scripts/examples/deployRealEstate.ts --network localhost
```

### 🌳 Agriculture (Musang King Durian Farm)

```
Asset:         Musang King Durian Farm, Raub, Pahang
SPV:           Raub Durian Holdings Sdn Bhd
Jurisdiction:  MY
Token:         DURIAN — 500,000 tokens
Compliance:    None (open retail trading)
Yield:         ~18% annual (harvest-dependent)
Distribution:  Per-harvest USDC payouts
Duration:      5-year cycle (trees bear fruit from year 3)
Bonding Curve: $0.20 floor, $100,000 funding target
Oracle Update: Pre-season + post-harvest
```

```bash
npx hardhat run scripts/examples/deployDurian.ts --network localhost
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install protocol dependencies
cd RWA20
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Start local node
npm run node

# Deploy in another terminal
npm run deploy:local

# Run example assets
npx hardhat run scripts/examples/deployRealEstate.ts --network localhost
npx hardhat run scripts/examples/deployDurian.ts --network localhost
```

### Frontend

```bash
# Copy deployed addresses to frontend
cp deployed-addresses.json frontend/lib/deployedAddresses.json

# Set up env
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your deployed addresses

# Install and run
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with protocol stats and asset templates |
| `/launch` | 3-step wizard to deploy a new RWA token |
| `/assets` | Explorer: browse all launched assets with filter/search |
| `/assets/[address]` | Asset detail: oracle data, bonding curve, revenue claim |
| `/portfolio` | User's holdings + claimable revenue across all assets |

---

## Deployment

### Local (Hardhat node)

```bash
npm run node
npm run deploy:local
```

### Sepolia Testnet

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
npm run deploy:sepolia
```

### Polygon / Amoy

```bash
npx hardhat run scripts/deploy.ts --network polygon-amoy
```

---

## Security Considerations

### Smart Contract

- **Reentrancy**: `RevenueDistributor`, `WRWA20`, and `BondingCurve` all use `ReentrancyGuard`
- **Access control**: All privileged functions use `AccessControl` — no `Ownable` on the token
- **Integer overflow**: Solidity 0.8.24 has built-in overflow protection
- **Compliance bypass**: Compliance is checked in `_update()` — cannot be bypassed via `transferFrom`
- **Snapshot safety**: `snapshotBlock = block.number - 1` ensures `getPastVotes()` always has a finalized checkpoint
- **Auto-delegate**: `mint()` auto-delegates to recipient so snapshots work without user action

### Production Checklist

- [ ] Audit all contracts (especially `RevenueDistributor` and `BondingCurve`)
- [ ] Use production USDC (not MockUSDC)
- [ ] Set `minTier = ACCREDITED` in `BasicCompliance` for real estate
- [ ] Configure jurisdiction allowlist before issuing tokens
- [ ] Set a non-zero `launchFee` to prevent spam
- [ ] Use a multisig for `DEFAULT_ADMIN_ROLE`
- [ ] Add price oracle staleness checks (`isStale()` in `AssetOracle`)
- [ ] Implement Chainlink / Pyth for NAV feeds in production

---

## Gas Estimates (approximate, Hardhat local)

| Operation | Gas |
|-----------|-----|
| Deploy full stack (via factory) | ~4.2M |
| `launch()` via launchpad | ~4.5M |
| `mint()` | ~80K |
| `transfer()` (NoCompliance) | ~55K |
| `transfer()` (BasicCompliance) | ~90K |
| `createPeriod()` | ~130K |
| `claim()` | ~85K |
| `claimMultiple(5 periods)` | ~180K |
| `wrap()` / `unwrap()` | ~65K |
| `buy()` (BondingCurve) | ~100K |

---

## Module Dependency Graph

```
contracts/
├── core/
│   ├── IRWA20.sol            ← shared types (AssetType, LegalInfo, CustodyInfo)
│   ├── RWA20Token.sol        ← inherits IRWA20, ERC20Votes, AccessControl
│   └── RWA20Factory.sol      ← deploys full stack, no token logic
├── compliance/
│   ├── IComplianceModule.sol ← interface
│   ├── NoCompliance.sol      ← pass-through
│   └── BasicCompliance.sol   ← KYC + jurisdiction + tier
├── revenue/
│   └── RevenueDistributor.sol ← reads ERC20Votes, distributes USDC
├── oracle/
│   └── AssetOracle.sol        ← role-restricted data store
├── wrapper/
│   └── WRWA20.sol             ← 1:1 ERC20 wrapper for DEX
├── launchpad/
│   ├── BondingCurve.sol       ← linear pricing, calls token.mint()
│   └── RWALaunchpad.sol       ← calls RWA20Factory + deploys BondingCurve
└── mocks/
    └── MockUSDC.sol           ← 6-decimal ERC20 for testing
```

---

## Extension Points

| Feature | How to Add |
|---------|------------|
| Merkle drop compliance | Implement `IComplianceModule` with Merkle proof verification |
| ERC-1155 multi-asset | Extend `RWA20Token` with ERC-1155 features |
| Automated oracle | Add Chainlink Automation to call `oracle.updateData()` on schedule |
| NFT custody proof | Store an ERC-721 token ID in `CustodyInfo.custodian` |
| Multi-currency yield | Add `rewardToken` parameter to `RevenueDistributor` |
| vesting schedule | Add a `TokenVesting` module consuming `MINTER_ROLE` |
| governance | Wire `ERC20Votes` to `OpenZeppelin Governor` for DAO governance |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.24 |
| Framework | Hardhat + TypeChain |
| Libraries | OpenZeppelin Contracts v5 |
| Frontend | Next.js 14 (App Router) |
| Web3 | wagmi v2 + viem |
| Wallet | RainbowKit |
| Styling | Tailwind CSS |
| Testing | Chai + Hardhat Network Helpers |

---

## License

MIT
