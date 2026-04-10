# Contributing to RWA20 Protocol

RWA20 is an open-source protocol for tokenizing real-world assets. We welcome contributions from developers, legal researchers, compliance experts, and regulators worldwide.

## What We're Building

RWA20 aims to be the ERC20 of tokenized real-world assets — a shared standard that any issuer, platform, or regulator can extend without permission. The protocol has three layers:

1. **Core** — ERC20 + compliance hook + revenue distribution (immutable, audited)
2. **Jurisdiction modules** — country-specific compliance rules (extensible, community-maintained)
3. **Attestation adapters** — on-chain legal proof bridges (pluggable per legal system)

---

## Quick Contribution Paths

| I want to... | What to do |
|---|---|
| Add a new country jurisdiction | See [Adding a Jurisdiction](#adding-a-jurisdiction) |
| Integrate a new legal attestation source | See [Adding an Attestation Adapter](#adding-an-attestation-adapter) |
| Fix a bug | Open a PR against `main` with tests |
| Suggest a protocol change | Open a GitHub Discussion first |
| Report a security vulnerability | Email security@rwa20.org (never open a public issue) |

---

## Adding a Jurisdiction

Adding support for a new country is the most common contribution. Here is the exact process:

### Step 1 — Research

Before writing any code, open a GitHub Discussion with:
- ISO 3166-1 alpha-2 country code
- Applicable securities/RWA regulation (law name + year)
- Regulator name and website
- Investor classification tiers (names + thresholds)
- Key transfer restrictions (lock-up periods, investor caps, etc.)
- On-chain legal bodies available (land registry, corporate registry, court system)
- Any existing blockchain/DLT legal frameworks

Use the template in `.github/DISCUSSION_TEMPLATE/new-jurisdiction.md`.

### Step 2 — Implement

Create `contracts/jurisdictions/XXJurisdiction.sol` (replace XX with ISO code):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseJurisdiction.sol";

/// @title XXJurisdiction — [Country Name] [Regulator] Framework
/// @notice Implements [Law Name] investor classification and transfer rules
/// @dev Key rules:
///   - Investor tiers: [list them]
///   - Min class for private placement: [class]
///   - Holding period: [duration or N/A]
///   - Investor cap: [number or N/A]
contract XXJurisdiction is BaseJurisdiction {
    function jurisdictionCode() public pure override returns (string memory) { return "XX"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "[Country] [Regulator] ([Key Law])";
    }
    function minimumClass() public view override returns (InvestorClass) { ... }
    function _validateInvestorClass(InvestorClass cls) internal pure override { ... }
    function _additionalTransferChecks(address, address, uint256)
        internal view override returns (bool, string memory) { ... }
}
```

### Step 3 — Document

Add a section to `docs/legal-compliance-architecture.md` with:
- Legal basis (exact law citations)
- Investor tier thresholds (with source citations)
- On-chain legal bodies and their attestation capabilities
- Any notable transfer restrictions

### Step 4 — Test

Write tests in `test/jurisdictions/XXJurisdiction.test.ts`:
- Deploy module, register investors of each class
- Verify canTransfer passes for valid pairs
- Verify canTransfer fails for invalid pairs (wrong class, holding period, cap)
- Verify revokeInvestor blocks transfers

### Step 5 — PR

Open a PR with:
- `contracts/jurisdictions/XXJurisdiction.sol`
- `test/jurisdictions/XXJurisdiction.test.ts`
- Section added to `docs/legal-compliance-architecture.md`
- Your jurisdiction code added to `JurisdictionRegistry` deployment script

### Legal Disclaimer

Jurisdiction modules represent a good-faith interpretation of securities law, not legal advice. All production deployments must be reviewed by qualified legal counsel in the relevant jurisdiction. Contributors should cite primary legal sources (statutes, regulations, official guidance) in code comments.

---

## Adding an Attestation Adapter

To bridge a new legal proof source (e.g. a country's land registry, a decentralized court system):

### Step 1 — Define the proof type

Check if the attestation maps to an existing `AttestationType` in `ILegalAttestation.sol`. If not, open a Discussion to propose adding a new type. AttestationTypes should be jurisdiction-agnostic (e.g. `PROPERTY_TITLE` covers all countries' land registries).

### Step 2 — Implement the adapter

Create `contracts/attestation/XXAdapter.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LegalAttestationRegistry.sol";

/// @title XXAdapter — Bridge from [Source] to LegalAttestationRegistry
/// @notice Reads attestations from [source] and imports them via importAttestation()
contract XXAdapter is AccessControl {
    LegalAttestationRegistry public immutable registry;
    // ... source-specific interface ...

    function bridgeAttestation(/* source-specific params */) external onlyRole(BRIDGE_ROLE) {
        Attestation memory a = Attestation({
            // Map source fields to RWA20 Attestation struct
        });
        registry.importAttestation(a);
    }
}
```

### Step 3 — Document trusted attestors

For the adapter to work, the `LegalAttestationRegistry` admin must call `setTrustedAttestor()` for the attesting address. Document:
- How to verify the attestor address is legitimate (official publication, DNS TXT record, etc.)
- The schema or data format of the source
- Any API endpoints or on-chain addresses

---

## Development Setup

```bash
git clone https://github.com/rwa20-protocol/rwa20
cd rwa20
npm install
npx hardhat compile
npx hardhat test
```

### Repository structure

```
contracts/
  core/          # RWA20Token, Factory, interfaces — stable, heavily audited
  compliance/    # IComplianceModule, NoCompliance, BasicCompliance
  attestation/   # ILegalAttestation, Registry, EASAdapter
  jurisdictions/ # IJurisdictionModule, BaseJurisdiction, country modules
  revenue/       # RevenueDistributor (snapshot USDC payouts)
  oracle/        # AssetOracle (NAV + yield)
  wrapper/       # WRWA20 (DEX-tradeable wrapper)
  launchpad/     # RWALaunchpad, BondingCurve
  protocol/      # ProtocolFeeManager
  mocks/         # MockUSDC (testing only)
docs/
  legal-compliance-architecture.md  # On-chain legal bodies + jurisdiction rules
frontend/
  app/           # Next.js pages
  components/    # Shared UI components
  lib/           # Contract ABIs, wagmi config
scripts/
  deploy.ts      # Core protocol deployment
  examples/      # Real Estate + Agriculture example launches
test/            # Hardhat/chai tests
```

---

## Code Standards

### Solidity
- Version: `^0.8.24`
- Follow the existing NatSpec comment style (`/// @notice`, `/// @dev`)
- All public state mutations must emit events
- No Unicode characters in strings (use ASCII only) — Solidity parser limitation
- Use `viaIR: true` + optimizer enabled (200 runs) as configured in `hardhat.config.ts`

### TypeScript / Frontend
- Next.js 14 App Router
- wagmi v2 + viem for all on-chain reads/writes
- Tailwind CSS — no external UI libraries
- Type everything — no `any` except where unavoidable

### Testing
- Aim for >90% line coverage on new contracts
- Test the unhappy path (rejections, revocations, caps) as thoroughly as the happy path
- Use `ethers.provider.snapshot()` / `revert()` for test isolation

---

## Governance

### Current phase: Benevolent Dictator

The core team holds final say on protocol changes. All significant changes go through:
1. GitHub Discussion (RFC phase, min 7 days)
2. Community feedback period
3. Core team review + merge

### Future: DAO

When the governance token launches, protocol parameter changes (fee levels, new jurisdiction approvals, treasury allocation) will move to on-chain governance via a Governor contract. The smart contracts are architected for this transition — `ProtocolFeeManager` and `JurisdictionRegistry` already have role-based access designed for eventual DAO control.

---

## Security

- Do not open public GitHub issues for security vulnerabilities
- Email: security@rwa20.org
- PGP key: published at keybase.io/rwa20
- Bug bounty program: TBD at launch

### Known trusted attestor requirements

Before a jurisdiction module can be used in production, the trusted attestors registered in `LegalAttestationRegistry` must be verifiable through an official channel. We maintain a public list of verified attestor addresses in `docs/trusted-attestors.json`.

---

## License

All contracts in `contracts/` are MIT licensed. Contributions must be submitted under MIT.

By submitting a pull request, you certify that:
1. The code is your original work or properly attributed
2. You have the right to submit it under the MIT license
3. You understand that jurisdiction modules do not constitute legal advice

---

*RWA20 is built by practitioners for practitioners. Whether you're a Solidity dev in Singapore, a legal researcher in Switzerland, or a regulator in Malaysia — you are welcome here.*
