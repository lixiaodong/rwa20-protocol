# RWA20 Protocol

<div align="center">

**The Open Standard for Real-World Asset Tokenization**

[![License: MIT](https://img.shields.io/badge/License-MIT-00d9ff.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-00ff9d.svg)](https://soliditylang.org)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-v5-7c3aed.svg)](https://openzeppelin.com)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow.svg)](https://hardhat.org)
[![Contracts](https://img.shields.io/badge/Contracts-75-brightgreen.svg)](#architecture)
[![Jurisdictions](https://img.shields.io/badge/Jurisdictions-6_Live-00d9ff.svg)](#jurisdictions)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-00ff9d.svg)](CONTRIBUTING.md)

[🌐 Website](https://lxd422152276.github.io/rwa20-protocol/) · [📄 Whitepaper](https://lxd422152276.github.io/rwa20-protocol/whitepaper.html) · [📚 Docs](docs/) · [🤝 Contributing](CONTRIBUTING.md)

</div>

---

## What is RWA20?

RWA20 is an open-source Ethereum protocol for tokenizing real-world assets (RWA) — real estate, private equity, commodities, funds, and more — with **native multi-jurisdiction legal compliance baked into the token itself**.

Think of it as **ERC20 for the physical world**: a permissionless standard that any developer, asset manager, or legal entity can build on. The compliance layer is not an add-on — it lives inside ERC20's `_update()` transfer hook, making it technically impossible to bypass.

```
Global RWA Market  ≈ $500 Trillion
Currently Tokenized  < 0.01%
The Bottleneck       = Compliance
RWA20 Solution       = Compliance as Protocol Primitive
```

## Key Features

| Feature | Description |
|---|---|
| 🔒 **Compliance-Native** | Legal checks inside ERC20 `_update()` hook — every transfer enforced, zero bypass |
| 🌍 **Multi-Jurisdiction** | OR-logic: qualify in ANY of 6 jurisdictions to transact |
| ⚖️ **On-Chain Legal Proofs** | EAS + Kleros + ADGM Courts — 9 attestation types |
| 💰 **Revenue Distribution** | O(1) snapshot-based yield/rent/dividend distribution |
| 📈 **Bonding Curve Launchpad** | Fair-launch price discovery for any asset |
| 🔄 **DEX Wrapper** | Compliant tokens trade on Uniswap via wRWA20 |
| 🗳️ **Governance Ready** | ERC20Votes — token holders vote on day one |
| ⚡ **Zero Bootstrap Fees** | 0% fees in Phase 0; hard-capped max 1% in code |

## Jurisdictions

| Flag | Country | Regulatory Framework | Status |
|---|---|---|---|
| 🇸🇬 | Singapore | MAS SFA §274/275 | ✅ Live |
| 🇨🇭 | Switzerland | FINMA FinSA · DLT Act (Registerwertrechte) | ✅ Live |
| 🇦🇪 | UAE | ADGM FSRA · VARA Investment Token Rules | ✅ Live |
| 🇱🇮 | Liechtenstein | TVTG Token Container Model · FMA TT Register | ✅ Live |
| 🇲🇾 | Malaysia | SC Malaysia CMSA · Digital Assets Guidelines | ✅ Live |
| 🇺🇸 | United States | SEC Reg D 506(b/c) · Reg S · Rule 144 | ✅ Live |
| 🇯🇵 | Japan | FSA FIEA | 🔜 Coming |
| 🇬🇧 | United Kingdom | FCA FSMA | 🔜 Coming |

**Adding a new jurisdiction takes one contract deployment.** See [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-jurisdiction).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   DApp Frontend                      │
│         Next.js · wagmi v2 · RainbowKit              │
├─────────────────────────────────────────────────────┤
│                Protocol Layer                        │
│  RWA20Token · RevenueDistributor · RWALaunchpad      │
│  wRWA20Wrapper · ProtocolFeeManager · RWAOracle      │
├─────────────────────────────────────────────────────┤
│              Compliance Engine                       │
│  MultiJurisdictionCompliance · JurisdictionRegistry  │
│  SG · CH · UAE · LI · MY · US Jurisdiction Modules  │
├─────────────────────────────────────────────────────┤
│           Legal Attestation Layer                    │
│  LegalAttestationRegistry · EASAdapter · Kleros     │
├─────────────────────────────────────────────────────┤
│              Infrastructure                          │
│     Ethereum EVM · OpenZeppelin v5 · Chainlink       │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
git clone https://github.com/lxd422152276/rwa20-protocol.git
cd rwa20-protocol
npm install
npx hardhat compile   # 75 contracts, 0 errors
npx hardhat test
```

## Usage Example

```typescript
// 1. Deploy multi-jurisdiction compliance
const compliance = await MultiJurisdictionCompliance.deploy(registry.address);
await compliance.enableJurisdiction("SG");
await compliance.enableJurisdiction("US");

// 2. Deploy the RWA token (compliance hook wired at construction)
const token = await RWA20Token.deploy("KL Tower Floor 12", "KLT12", compliance.address);

// 3. Register investors per-jurisdiction
await sgModule.registerInvestor(investor1, InvestorClass.ACCREDITED);
await usModule.registerInvestor(investor2, InvestorClass.ACCREDITED);

// 4. All transfers are compliance-checked automatically
await token.mint(investor1, ethers.parseEther("1000"));
await token.connect(investor1).transfer(investor2, 100); // ✅ both qualify

// 5. Distribute revenue (rent, yield, dividends)
await distributor.distribute({ value: ethers.parseEther("10") });
await distributor.connect(investor1).claim(distributionId); // O(1) claim
```

## How Compliance Works

```
token.transfer(to, amount)
        ↓
  ERC20._update()            ← compliance runs HERE (unforgeable)
        ↓
  MultiJurisdictionCompliance.canTransfer()
        ↓
  OR-logic across all enabled jurisdiction modules:
  ├── SGJurisdiction.isActiveInvestor(from)?  ← MAS SFA §274
  ├── USJurisdiction.isActiveInvestor(from)?  ← SEC Reg D
  └── CHJurisdiction.isActiveInvestor(from)?  ← FINMA FinSA
        ↓
  Both parties qualify in ≥1 jurisdiction → ✅ Transfer proceeds
  Either party fails all jurisdictions   → ❌ Revert: "compliance blocked"
```

This applies to **every transfer** — direct, DEX, bridge, multisig — without exception.

## Protocol Fees

All fees start at **0%** in Phase 0. Hard caps are immutable in contract code:

| Fee Type | Hard Cap | Phase 0 | Phase 1 (planned) |
|---|---|---|---|
| Asset Issuance | 1.00% | **0%** | 0.05% |
| Revenue Distribution | 2.00% | **0%** | 0.50% |
| DEX Swap | 0.30% | **0%** | 0.10% |

Fee routing: 70% treasury · 20% ecosystem grants · 10% RWAG stakers

## Legal Attestation Types

| Type | Use Case |
|---|---|
| `PROPERTY_TITLE` | Real estate deed, land registry |
| `CORPORATE_RECORD` | Company registration, shareholder register |
| `COURT_ORDER` | ADGM/DIFC court judgment, arbitration award |
| `AUDIT_CERTIFICATE` | Big 4 financial audit, NAV verification |
| `KYC_VERIFICATION` | AML-compliant identity check |
| `REGULATORY_APPROVAL` | MAS/FINMA/SEC official clearance |
| `VALUATION_REPORT` | RICS-certified asset valuation |
| `CUSTODY_PROOF` | Licensed custodian confirmation |
| `LEGAL_OPINION` | Counsel's securities law analysis |

## Contributing

We especially need:

- **Lawyers & Compliance Experts** — Review/add jurisdiction modules
- **Solidity Developers** — Protocol features, test coverage, auditing
- **Frontend Developers** — DApp UX, data visualization
- **Asset Managers** — Pilot issuances, product feedback
- **Regulators** — Official engagement, guidance, recognition

See [CONTRIBUTING.md](CONTRIBUTING.md) for the 5-step guide to adding a new jurisdiction.

## Roadmap

| Phase | Status | Key Milestones |
|---|---|---|
| 0 — Bootstrap | ✅ **Complete** | Open source, 75 contracts, 6 jurisdictions |
| 1 — Community | 🔄 **Active** | Mainnet deploy, audit, JP+GB, first 10 issuances |
| 2 — DAO | 📋 Planned | RWAG governance token, on-chain voting |
| 3 — Standard | 🔭 Vision | 20+ jurisdictions, EIP proposal, enterprise SaaS |

## Security

> ⚠️ **Not yet audited.** Deploy on testnets only until a formal audit is completed.

- Compliance in `_update()` — technically impossible to bypass
- Snapshot revenue uses `block.number - 1` (flash loan protection)
- Fee hard caps are immutable constants
- Attestors are trust-scoped per jurisdiction

Audit contributions and security reviews are welcome. Open a [security issue](https://github.com/lxd422152276/rwa20-protocol/issues).

## Links

- 🌐 **Website:** https://lxd422152276.github.io/rwa20-protocol/
- 📄 **Whitepaper:** https://lxd422152276.github.io/rwa20-protocol/whitepaper.html
- 🤖 **AI-readable:** https://lxd422152276.github.io/rwa20-protocol/llms.txt
- 💬 **Discussions:** https://github.com/lxd422152276/rwa20-protocol/discussions
- 📧 **Contact:** lxd422152276@gmail.com

## License

MIT © RWA20 Protocol Contributors

---

<div align="center">
<strong>⭐ Star this repo if you believe open standards will unlock the $500T RWA market</strong>
</div>
