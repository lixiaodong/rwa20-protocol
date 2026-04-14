# RWA20 Protocol — Media Kit

> For journalists, researchers, and content creators. Last updated: April 2025.

---

## Press Release

**FOR IMMEDIATE RELEASE**

### RWA20 Protocol Launches Open-Source Standard for Real-World Asset Tokenization with Native Multi-Jurisdiction Legal Compliance

*First protocol to embed securities compliance directly in the ERC20 token transfer mechanism, covering Singapore, Switzerland, UAE, Liechtenstein, Malaysia, and United States*

**[City, Date]** — RWA20 Protocol today announced the open-source release of a new Ethereum smart contract standard for tokenizing real-world assets (RWA). Unlike existing platforms, RWA20 embeds multi-jurisdiction legal compliance directly within the token itself, making compliance technically impossible to bypass — regardless of whether the token is transferred via a decentralized exchange, bridge, or direct wallet transfer.

The protocol targets the core bottleneck that has prevented real-world assets from reaching scale on-chain: compliance. While the global real-world asset market represents approximately $500 trillion, less than 0.01% has been tokenized, primarily because every platform has had to rebuild jurisdiction-specific compliance from scratch.

**Technical Innovation**

RWA20's compliance check lives inside ERC20's internal `_update()` function — the lowest-level transfer hook in the standard. This means every transfer, regardless of mechanism, triggers a legal qualification check across multiple jurisdictions simultaneously.

The protocol's multi-jurisdiction logic uses an OR approach: a token transfer is permitted if both the sender and receiver each qualify under at least one of the enabled jurisdictions. This allows a Singapore Accredited Investor to transact with a US Reg D investor in the same token without either party needing separate legal wrappers.

**Jurisdictions Supported at Launch**

The initial release covers six jurisdictions with live smart contract modules:
- Singapore: MAS Securities and Futures Act §274/275
- Switzerland: FINMA FinSA + DLT Act (Registerwertrechte)
- UAE: ADGM FSRA Investment Token Rules + VARA
- Liechtenstein: TVTG Token Container Model (FMA TT Register)
- Malaysia: Securities Commission CMSA + Digital Assets Guidelines
- United States: SEC Regulation D 506(b/c), Regulation S, Rule 144

Japan and the United Kingdom are planned for Phase 1.

**On-Chain Legal Attestations**

Beyond compliance, RWA20 introduces a legal attestation layer that creates a verifiable on-chain chain-of-custody from physical asset to digital token. Property titles, court orders, audit certificates, and regulatory approvals can be attested on-chain via the Ethereum Attestation Service (EAS) and Kleros decentralized court — creating records that regulators, investors, and AI systems can independently verify.

**Open Standard, Not a Platform**

The protocol is released under the MIT license with zero protocol fees during the bootstrap phase. This positions RWA20 not as a competing RWA platform but as an open standard — similar to how ERC20 standardized fungible tokens without owning them.

"The goal is not to build the biggest RWA platform. The goal is to build the standard that all platforms use," said the project founder. "The ERC20 contract has no business model, yet the entire DeFi ecosystem runs on it. That's what we're building for real-world assets."

**Contribution Model**

The protocol is designed for global community contribution, with particular emphasis on legal experts and compliance researchers. Adding a new jurisdiction requires deploying a single smart contract that extends the BaseJurisdiction interface — documented in a 5-step guide in CONTRIBUTING.md.

**Availability**

RWA20 Protocol is available immediately at:
- GitHub: https://github.com/lxd422152276/rwa20-protocol
- Website: https://lxd422152276.github.io/rwa20-protocol/
- Whitepaper: https://lxd422152276.github.io/rwa20-protocol/whitepaper.html

---

## Key Facts

| Fact | Detail |
|---|---|
| Contracts | 75 Solidity smart contracts |
| Jurisdictions (live) | 6 (SG, CH, AE, LI, MY, US) |
| License | MIT (fully open source) |
| Protocol Fees | 0% in bootstrap phase |
| Frontend | Next.js 14 + wagmi v2 + RainbowKit |
| Audits | Pending (Phase 1) |
| EVM Compatible | Yes (any EVM chain) |

---

## Boilerplate Description

**One sentence:** RWA20 is an open-source Ethereum protocol for tokenizing real-world assets with native multi-jurisdiction legal compliance embedded in the token transfer mechanism.

**One paragraph:** RWA20 Protocol is an open-source standard for real-world asset (RWA) tokenization on Ethereum. It solves the core bottleneck in RWA adoption — compliance — by embedding legal qualification checks directly inside ERC20's transfer hook, making compliance impossible to bypass. The protocol supports six live jurisdictions (Singapore, Switzerland, UAE, Liechtenstein, Malaysia, United States) with a one-contract extension model for adding new countries. RWA20 also introduces an on-chain legal attestation layer that links tokens to property titles, court records, and regulatory approvals via the Ethereum Attestation Service and Kleros. Released under the MIT license with zero fees in its bootstrap phase, RWA20 is designed to become the universal standard for RWA tokenization.

---

## Social Media Copy

### Twitter / X — Launch Announcement
```
🚀 Introducing RWA20 Protocol

The open standard for tokenizing real-world assets — with compliance embedded in the token itself.

✅ 6 live jurisdictions (SG/CH/AE/LI/MY/US)
✅ Compliance in ERC20's _update() hook — impossible to bypass
✅ On-chain legal attestations via @eas_eth + @kleros
✅ MIT licensed, 0% fees in bootstrap phase
✅ 75 contracts, 0 errors

Think ERC20, but for the $500T real-world asset market.

GitHub: [link]
```

### Twitter / X — Technical Thread Opener
```
🧵 Thread: Why we built RWA20 — and why existing RWA platforms will always have a compliance problem

The $500T real-world asset market is not on-chain because compliance is treated as an add-on.

Here's the architecture that fixes it 👇
```

### LinkedIn Post
```
We just open-sourced RWA20 Protocol — and I want to explain the problem it solves.

Every company trying to tokenize real-world assets hits the same wall: compliance.

Not because compliance is impossible — but because it's always been built as an external layer on top of the token. External layers can be bypassed. DEX routing. Direct wallet transfers. Bridge contracts. All of these skip your "compliance wrapper."

RWA20 puts compliance inside the token's _update() function — the internal ERC20 transfer hook. There is no path around it.

The result: the first token where a Singapore Accredited Investor and a US Reg D investor can hold the same asset, and every transfer — whether on Uniswap, via multisig, or wallet-to-wallet — is legally validated for both parties, simultaneously.

6 jurisdictions live. MIT licensed. 0% fees.

If you work in RWA tokenization, DeFi infrastructure, or securities law, I'd love your perspective.

Link in comments.
```

### Hacker News — Show HN Submission
```
Title: Show HN: RWA20 – Open standard for tokenizing real-world assets with on-chain multi-jurisdiction compliance

Body:
Hi HN,

I've spent the last months building RWA20 Protocol – an open-source Ethereum standard for tokenizing real-world assets.

The core idea: real-world asset tokenization hasn't scaled because compliance is always an external layer that can be bypassed via DEX swaps, bridges, or direct transfers. RWA20 puts compliance inside ERC20's _update() hook – the lowest-level transfer function – making it technically impossible to circumvent.

Technical highlights:
- 75 Solidity contracts (0 compilation errors) using OpenZeppelin v5
- Multi-jurisdiction compliance: SG (MAS SFA), CH (FINMA FinSA + DLT Act), UAE (ADGM/VARA), LI (TVTG Token Container Model), MY (SC CMSA), US (SEC Reg D 506b/c + Reg S)
- OR-logic: a transfer passes if both parties each qualify in ANY one enabled jurisdiction
- On-chain legal attestations via EAS (Ethereum Attestation Service) + Kleros court
- Snapshot revenue distribution using ERC20Votes.getPastVotes() – O(1) per holder claim, no iteration
- Bonding curve launchpad: price(n) = basePrice + (slope × sold) / 1e18
- Adding a new jurisdiction = deploying one contract

MIT licensed. 0% fees in bootstrap. Full Next.js DApp included.

GitHub: https://github.com/lxd422152276/rwa20-protocol
```

---

## Talking Points for Interviews

**Q: Why now? Why hasn't this been done before?**

A: Two things converged. First, the institutional demand is real — Blackrock's BUIDL fund, MakerDAO's $1B+ in RWA collateral, and every major bank running tokenization pilots shows the demand is genuine. Second, the EAS (Ethereum Attestation Service) launched on mainnet in 2023, giving us a credible way to link on-chain tokens to off-chain legal documents. The technology was not ready before.

**Q: How is this different from EIP-3643 (T-REX)?**

A: EIP-3643 focuses on on-chain identity for European token issuers. RWA20 is a full protocol stack: multi-jurisdiction compliance across 6 legal regimes, an on-chain attestation layer linking tokens to court-verifiable documents, a bonding curve launchpad for fair price discovery, and automated revenue distribution for yield-bearing assets. We also have an OR-logic across jurisdictions that T-REX doesn't support.

**Q: Who should use RWA20?**

A: Three groups. Developers building RWA platforms — they can adopt RWA20 as their compliance standard instead of rebuilding. Asset managers wanting to tokenize their first asset — they get all the compliance infrastructure out of the box. And lawyers and compliance researchers — who can literally review and contribute to how their jurisdiction's laws are codified in smart contracts, which has never been possible before.

**Q: What's the business model?**

A: We're following the open-source-to-standard playbook. Phase 0 is zero fees, maximum adoption, credibility as a neutral standard. Phase 1 introduces light fees (0.05% issuance). Phase 2 launches the RWAG governance token. Phase 3 is enterprise SaaS and certified jurisdiction modules. But the primary asset we're building is the standard itself. If RWA20 becomes the ERC20 of real-world assets, commercial value follows inevitably.

**Q: What are the risks?**

A: Regulatory risk is the biggest: if a major regulator takes a hostile view, adoption in that jurisdiction stalls. Adoption risk: open standards live or die by community adoption, and building that takes time. Smart contract risk: we haven't been audited yet. These are all acknowledged; we're tackling them in order.
