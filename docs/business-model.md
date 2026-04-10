# RWA20 Protocol — Business Model & Go-to-Market Strategy

## The Core Insight

Real-world asset tokenization is a $16T+ market that is being held back not by technology, but by two things:
1. **Legal interoperability** — no standard exists for linking on-chain tokens to real-world legal claims
2. **Regulatory fragmentation** — each country has its own rules with no common technical interface

RWA20 solves both. The goal: become the ERC20 of real-world assets — a standard so fundamental that the industry cannot function without it.

---

## Phase 0: Open Source First (Now)

### Why zero fees?

The most powerful distribution strategy is adoption. Every project that deploys RWA20 tokens becomes a node in the ecosystem. Every jurisdiction module merged into the repo represents regulatory coverage that would cost millions of dollars in legal fees to replicate.

Zero fees means:
- No reason to build a competing standard
- Regulatory bodies engage with standards, not commercial products
- Developers deploy on RWA20 because it's the best option, not because they're locked in

**The playbook:** Build what Linux did for servers. Build what ERC20 did for tokens. Build what Stripe did for payments — start as infrastructure, become indispensable.

### Phase 0 actions

| Action | Goal |
|---|---|
| Publish all contracts on GitHub (MIT) | Maximum developer adoption |
| Submit to OpenZeppelin Defender + Certora | Community security credibility |
| Deploy on Polygon, Base, Arbitrum testnets | Multi-chain presence |
| Publish docs at rwa20.org | SEO, developer discovery |
| Submit to EthCC, Token2049, Paris Blockchain Summit | Regulator + BD exposure |
| Engage MAS, VARA, FCA, SC directly | Pre-regulatory alignment |
| Open-source jurisdiction modules | Country-specific community building |

---

## The Standard Moat

### How standards create durable competitive moats

Once RWA20 is widely adopted:
- Every jurisdiction module written by the community becomes protocol-specific
- Every KYC provider, attestation service, or auditor that integrates does so for RWA20 first
- Every law firm that writes legal opinions references RWA20 schemas
- Every exchange that lists RWA20 tokens builds infrastructure around the standard

This is the network effect of a standard, not of a product. It is extremely difficult to unseat.

### Comparable precedents

| Standard | Adopter | Monetization path |
|---|---|---|
| ERC20 | Ethereum / OpenZeppelin | Gas fees (ETH), audit services |
| SWIFT | Banks | Transaction fees ($x per wire) |
| FIX Protocol | Trading firms | Certification programs |
| OIDC / OAuth2 | Auth0, Okta | SaaS on top of free standard |

RWA20 follows the Auth0 / Okta model: the standard is free, the managed service is paid.

---

## Phase 1: Ecosystem Growth (6–18 months post-launch)

### When to activate

Activate fees when:
- 10+ live asset deployments on mainnet
- 3+ jurisdictions with real investors registered
- Active community with 50+ GitHub contributors
- At least one regulatory acknowledgment from a target jurisdiction

### Fee activation (governance vote required)

```
Issuance fee:      0.05%  of initial NAV
Distribution fee:  0.5%   of USDC distributed to token holders
Bonding curve fee: 0.5%   of fundraising purchases
```

### Phase 1 revenue model (projected)

Assumptions for illustrative purposes:
- 100 assets launched with average $1M NAV each → $50K issuance fees
- $10M total distributions/year → $50K distribution fees
- $5M bonding curve volume → $25K curve fees
- **Total Phase 1 ARR: ~$125K**

This is enough to fund 2–3 core developers and begin the audit program.

### Revenue routing (Phase 1)

```
70%  Protocol Treasury  → Core dev, security audits, bug bounties
20%  Ecosystem Fund     → Grants for jurisdiction modules, integrations
10%  Reserve            → Bridge to governance token launch (Phase 2)
```

---

## Phase 2: DAO + Governance Token (18–36 months)

### Why a governance token?

1. **Coordination at scale** — When 50+ jurisdictions and hundreds of asset issuers use the protocol, no single team can make all decisions
2. **Capture ecosystem value** — Contributors (jurisdiction module authors, attestation adapters, KYC integrations) should share in protocol success
3. **Regulatory tool** — Distributed governance is harder to regulate as a single entity

### Token design (high level)

**RWA20 Governance Token (RWAG)**

| Parameter | Value |
|---|---|
| Total supply | 100,000,000 RWAG |
| Community allocation | 40% — early contributors, jurisdiction authors, integrations |
| Team + advisors | 20% — 4-year vesting, 1-year cliff |
| Ecosystem Fund | 25% — grants, liquidity mining, BD |
| Protocol Reserve | 15% — DAO-controlled treasury |

**Utility:**
- Vote on fee parameter changes (within hard caps in ProtocolFeeManager)
- Vote on new jurisdiction module approvals
- Vote on treasury allocation
- Stake to earn a share of protocol fees (10% of fee revenue routed to stakers)
- Required for Enterprise API access (stake-to-access model)

**No speculative utility.** The token is designed for governance, not as a store of value. This reduces regulatory risk in most jurisdictions (particularly SEC Howey test concerns).

### Phase 2 revenue model (projected)

Assumptions:
- 500 assets, $500M total NAV, $50M/yr distributions
- Enterprise SaaS: 10 clients × $60K/yr = $600K
- Certified jurisdiction modules: 5 countries × $50K/yr premium tier
- **Total Phase 2 ARR: ~$1.5M**

---

## Phase 3: Enterprise & Institutional (3–5 years)

### The institutional pivot

By Phase 3, the protocol is a standard. The revenue shifts to services layered on top:

### Revenue stream 1: Enterprise SaaS

**Compliance Dashboard** — A hosted platform for asset managers, fund managers, and banks:
- Real-time investor compliance status across all jurisdictions
- Attestation lifecycle management (create, renew, revoke)
- Regulatory reporting (MAS Form CM, SEC Reg D filing data export)
- KYC provider integrations (Onfido, Synaps, Fractal)
- Webhook-based compliance events (investor revoked, attestation expired)

**Pricing:** $1,000–10,000/month per organization (depending on assets under management)

**TAM:** Every bank, fund manager, or fintech that wants to tokenize assets without building their own compliance infrastructure.

### Revenue stream 2: Certified Jurisdiction Modules

Community-authored jurisdiction modules are free and open-source. Certified modules are:
- Co-authored with a law firm in the relevant jurisdiction
- Accompanied by a legal opinion letter
- Audited by a recognized security firm
- Covered by an insurance policy

**Pricing:** $500–2,000/month subscription per jurisdiction for the certified version

**Why issuers pay:** Legal opinion letters are expensive ($50K–200K for a securities offering). A certified module + legal opinion at $2K/month is a fraction of the cost.

### Revenue stream 3: Attestation Verification SaaS

**AssetVerify** — A B2B API that institutional investors use to verify:
- Is this token's underlying asset legally verifiable?
- What on-chain attestations exist, and are they valid?
- Which jurisdictions is this token compliant in?

**Pricing:** $0.10–$1.00 per verification (pay-as-you-go) or $1,000–5,000/month flat

**Customers:** Due diligence teams at hedge funds, family offices, institutional exchanges

### Revenue stream 4: Protocol fees at scale

At $10B total asset NAV with 1% average annual distribution:
- Distribution fees at 0.5%: $500K/yr
- Issuance fees at 0.05% on $1B new assets/yr: $500K/yr
- **Protocol fee ARR: ~$1M/yr** (passive, requires zero additional effort)

### Phase 3 total ARR model

| Stream | Conservative | Optimistic |
|---|---|---|
| Enterprise SaaS | $3M | $12M |
| Certified jurisdiction modules | $1M | $5M |
| Attestation verification API | $500K | $3M |
| Protocol fees (passive) | $1M | $5M |
| **Total** | **$5.5M** | **$25M** |

---

## Go-to-Market: From Open Source to Market Leader

### Year 1: Credibility

**Target:** Be known in the right rooms, not famous everywhere.

Actions:
- Present at Money20/20, Token2049, and World Economic Forum Davos FinTech side events
- Submit protocol for review to MAS Project Catalyst, VARA sandbox, FCA Digital Securities Sandbox
- Partner with 1–2 law firms (Linklaters, Allen & Overy) to co-author the first certified jurisdiction modules
- Get 1 real asset launched on testnet, 1 on mainnet, with real investors

**Success metric:** Protocol mentioned in one regulatory consultation document

### Year 2: Momentum

**Target:** Be the first protocol a builder thinks of when tokenizing a real-world asset.

Actions:
- Host the first "RWA20 Builders Summit" (invite issuers, regulators, auditors, KYC providers)
- Launch jurisdiction module grant program (Ecosystem Fund)
- Partner with 3+ KYC providers (Synaps, Onfido, Fractal ID) for pre-built integrations
- Integrate with 1–2 major DEXes for wRWA20 trading (Uniswap v4 hooks, Curve pools)
- Publish annual "State of RWA Tokenization" report (become the Andreessen Horowitz for RWA research)

**Success metric:** $50M+ total assets under tokenization

### Year 3: Standard Status

**Target:** RWA20 is referenced in regulatory documents without being asked.

Actions:
- Submit to ISO/IEC for standardization consideration (ISO TC307 blockchain committee)
- Engage IOSCO (International Organization of Securities Commissions) directly
- Launch governance token with community vote
- Open Enterprise SaaS waitlist

**Success metric:** Protocol cited in MAS, FCA, or ESMA regulatory guidance

---

## Competitive Positioning

| Competitor | Approach | RWA20 Advantage |
|---|---|---|
| Securitize | Closed platform, US-focused | Open standard, multi-jurisdiction from day 1 |
| Polymath | Early ERC1400 (deprecated) | Modern architecture, EAS attestations, active development |
| TokenSoft | Service-oriented, not protocol | Protocol-first, self-deployable, no vendor lock-in |
| Backed Finance | Single-asset type (bonds) | Multi-asset (real estate, agriculture, gold, debt) |
| Ondo Finance | Institutional-grade but closed | Open source, community extensible |
| Centrifuge | RWA lending, complex | Simpler token standard, clearer legal model |

**The core differentiation:** RWA20 is a standard, not a product. Competitors are building products. Standards eat products.

---

## Risk Factors & Mitigations

### Risk: A major player forks and fragments the standard

**Mitigation:** MIT license means they can fork, but they cannot prevent RWA20 from existing and growing. Network effects favor the original. Every jurisdiction module contributed back to main benefits all users. Forkers have to maintain their own modules.

### Risk: Regulatory crackdown on tokenized assets

**Mitigation:** Regulatory compliance is built into the protocol, not bolted on. If regulations tighten, we add more restrictive jurisdiction modules. The protocol's multi-jurisdiction design means regulatory risk is distributed.

### Risk: Protocol fee competition (someone offers zero fees)

**Mitigation:** Zero fees is our current state. Our competitive advantage is the ecosystem (jurisdiction modules, attestation adapters, integrations), not the fee level. A zero-fee fork would need to rebuild the entire ecosystem.

### Risk: Smart contract vulnerability

**Mitigation:** Phased audit program (Trail of Bits, Certora, OpenZeppelin). Bug bounty program. Immutable core contracts (jurisdiction modules are upgradeable, core is not). Emergency pause in each jurisdiction module.

---

## The Long View

In 10 years, the global financial system will be partly tokenized. The question is not whether this happens, but who owns the infrastructure layer. The winner is whoever builds the standard that regulators trust, developers prefer, and lawyers can advise on.

RWA20 is positioned to be that standard: open enough to attract a community, structured enough to satisfy regulators, and technically sound enough for institutions.

The goal is not to build a $100M ARR company. The goal is to build the protocol layer of a $1T+ tokenized asset economy.

---

*Feedback on this document is welcome. Open a GitHub Discussion tagged `business-model` to contribute.*
