# RWA20 Legal Compliance Architecture

## On-Chain Legal Institutions & Multi-Jurisdiction Support

---

## 1. On-Chain Legal Bodies

One of the core challenges in tokenizing real-world assets is proving that an on-chain token corresponds to a real legal claim. The following on-chain institutions can issue verifiable proofs that are anchored on a public blockchain and traceable to real-world legal relationships.

### 1.1 Ethereum Attestation Service (EAS)

**What it is:** A general-purpose on-chain attestation protocol. Anyone can create a schema and issue attestations — but the trust comes from *who* issues them and whether the issuer is a recognized authority.

**Deployments:**
- Ethereum mainnet: `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587`
- Optimism / Base / Arbitrum / Polygon: available at canonical addresses

**How it creates legal proof:** A licensed land registry (e.g. Singapore Land Authority), licensed auditor, or court-authorized signer can issue an EAS attestation using a registered schema. The schema enforces what fields the attestation must contain (e.g. land title number, document hash, IPFS CID). The attestation is permanently anchored on-chain with the issuer's address as proof of origin.

**RWA20 integration:** The `EASAttestationAdapter` contract reads EAS attestations and imports them into the `LegalAttestationRegistry`. This creates a local cache that jurisdiction modules and compliance contracts can query cheaply.

**Example schemas in use:**

| Use Case | Schema fields | Issuer |
|----------|--------------|--------|
| Property title (SG) | `titleNumber`, `landVolume`, `ownerAddress`, `documentHash` | SLA-authorized signer |
| KYC attestation | `kycRef`, `jurisdiction`, `tier`, `expiresAt` | Licensed VASP / MyInfo relay |
| Audit certificate | `auditFirm`, `assetId`, `navUSD`, `periodEnd`, `reportHash` | Big 4 or accredited auditor wallet |
| Court order (ADGM) | `caseNumber`, `court`, `orderType`, `effectiveDate`, `documentHash` | ADGM court clerk wallet |

---

### 1.2 Kleros — Decentralized On-Chain Arbitration

**What it is:** A decentralized court protocol where disputes are resolved by randomly selected jurors from a staked pool. Rulings are final, transparent, and executable on-chain.

**Relevance to RWA:**
- **Dispute resolution:** If a buyer disputes the validity of a tokenized asset (e.g. title fraud, misrepresentation), Kleros can adjudicate and issue a binding on-chain ruling.
- **Curated lists:** Kleros TCRs (Token Curated Registries) can maintain whitelists of trusted asset issuers, auditors, or KYC providers — a decentralized alternative to a centralized registry.
- **Verification markets:** Kleros Escrow + arbitration can condition fund release on verified off-chain deliverables (e.g. asset transfer completion).

**How to integrate:** Kleros rulings are emitted as events on the `IArbitrable` interface. A Kleros adapter contract can listen for rulings on specific dispute IDs and translate them into `AttestationType.COURT_ORDER` attestations in the `LegalAttestationRegistry`.

---

### 1.3 ADGM Courts (Abu Dhabi Global Market)

**What it is:** A common law court system within the Abu Dhabi Global Market free zone. Internationally recognized — judgments are enforceable across 170+ jurisdictions under Hague Convention and bilateral treaties.

**Blockchain evidence:** ADGM Courts issued Practice Direction PD-2022-1 explicitly permitting blockchain transaction records as admissible evidence. Court proceedings can reference on-chain data.

**On-chain court orders:** ADGM has issued orders specifically referencing wallet addresses and smart contract states. The UAE central bank and ADGM FSRA coordinate on blockchain-native enforcement.

**Relevance to RWA:** An ADGM court order confirming asset ownership or collateral can be issued as an EAS attestation by an ADGM court-authorized signer, creating a legally recognized on-chain record traceable to a specific court proceeding.

---

### 1.4 DIFC Courts (Dubai International Financial Centre)

**What it is:** A common law court system within DIFC, with jurisdiction over financial disputes. The DIFC Digital Economy Court (established 2022) is the world's first dedicated blockchain/crypto court.

**World's first NFT injunction:** In 2022, DIFC Courts issued the world's first court order delivered via NFT (airdropped to the defendant's wallet). This established a precedent for on-chain service of process.

**Digital Assets Law 2024:** DIFC enacted a comprehensive digital assets law recognizing tokens as a form of property, with specific provisions for tokenized securities and RWA.

**Relevance to RWA:** DIFC court orders and judgments can be notarized on-chain by the court's authorized signing key, creating `AttestationType.COURT_ORDER` attestations that are legally traceable to DIFC proceedings.

---

### 1.5 Liechtenstein FMA (TT Register)

**What it is:** The Financial Market Authority of Liechtenstein maintains an official register of TT Service Providers (token issuers, custodians, depositaries) under the TVTG. This is an on-chain-compatible public registry.

**The Token Container Model:** Under TVTG Art. 4, a token is a legal container that holds any right. Owning the token = owning the right. Transfer of token = transfer of the legal right. This is the most legally powerful form of tokenized asset — the token IS the legal instrument, not merely evidence of it.

**FMA registration numbers** are publicly verifiable and can be included in token metadata, creating a direct legal chain: token address → FMA registration number → registered issuer → underlying asset.

---

### 1.6 Singapore SLA & ACRA (via EAS)

**SLA (Singapore Land Authority):** Operates the integrated land information management system. Title transfers are recorded in the Land Titles Registry. SLA has been piloting blockchain-based title records. An SLA-authorized signer can issue EAS attestations anchoring the on-chain title number to a specific property.

**ACRA (Accounting and Corporate Regulatory Authority):** Operates Bizfile+ for company registration. SPVs and VCCs (Variable Capital Companies) are registered here. ACRA corporate registry data can be attested on-chain to prove the legal existence and ownership of the issuing entity.

---

## 2. Attestation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Legal Bodies                         │
│                                                                  │
│  EAS Schemas    Kleros Courts    ADGM/DIFC     FMA (LI)         │
│  (issuer wallets)  (arbitration)  (court orders) (TT register)  │
└─────────┬───────────────┬──────────────┬────────────┬───────────┘
          │               │              │            │
          ▼               ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EASAttestationAdapter                         │
│   Reads EAS attestations, maps schema → AttestationType         │
│   Calls LegalAttestationRegistry.importAttestation()            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 LegalAttestationRegistry                         │
│                                                                  │
│  trusted attestors: jurisdiction × type → address[]             │
│  attestations:      uid → Attestation                           │
│  asset links:       assetId → uid[]                             │
│                                                                  │
│  hasValidAttestation("RE-MY-KL-001", PROPERTY_TITLE) → bool     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Jurisdiction Modules (optional use)                 │
│  Can query registry to require attestations before registering   │
│  investors or approving transfers                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Multi-Jurisdiction Architecture

### 3.1 Design Principles

**One contract per country.** Each jurisdiction is a self-contained `IJurisdictionModule` that encodes that country's specific rules: investor tiers, transfer restrictions, caps, lock-up periods. Adding a new country requires deploying one new contract and calling `registry.registerJurisdiction()`.

**The registry is the extension point.** `JurisdictionRegistry` maps ISO country codes to module addresses. It is the only place that needs to change (via a `registerJurisdiction()` call) when adding support for a new country.

**OR logic for multi-jurisdiction.** `MultiJurisdictionCompliance` implements the IComplianceModule interface and passes a transfer if either party qualifies under ANY enabled jurisdiction. This allows a Malaysian farm token to be sold to both Singapore and UAE investors without those investors needing KYC in each other's jurisdictions.

### 3.2 Contract Hierarchy

```
IComplianceModule                    (interface, called by RWA20Token._update())
    └── IJurisdictionModule          (extends: investor registration + jurisdiction identity)
            └── BaseJurisdiction     (abstract: storage, KYC roles, basic transfer logic)
                    ├── SGJurisdiction    (MAS SFA: Section 274/275, AI threshold, 50-cap)
                    ├── CHJurisdiction    (FINMA FinSA: QI threshold, lock-up)
                    ├── UAEJurisdiction   (ADGM FSRA: PC threshold, sanctions, 200-cap)
                    ├── LIJurisdiction    (TVTG: Token Container, FMA registration)
                    ├── MYJurisdiction    (SC CMSA: SI threshold, 200-cap)
                    └── USJurisdiction    (SEC: Reg D 506b/506c/Reg S, 12-month hold)

JurisdictionRegistry                 (maps "SG"/"CH"/... → module address)
MultiJurisdictionCompliance          (IComplianceModule with OR logic over registry)
```

### 3.3 How to Add a New Country

Suppose Bahrain (BH) joins the RWA20 ecosystem:

```solidity
// Step 1: Write the module (inherits BaseJurisdiction)
contract BHJurisdiction is BaseJurisdiction {
    function jurisdictionCode() public pure override returns (string memory) { return "BH"; }
    function jurisdictionName() public pure override returns (string memory) {
        return "Bahrain CBB (Regulatory Sandbox / FinTech Rules)";
    }
    function minimumClass() public view override returns (InvestorClass) { ... }
    function _validateInvestorClass(InvestorClass cls) internal pure override { ... }
    function _additionalTransferChecks(...) internal view override returns (bool, string memory) { ... }
}

// Step 2: Deploy it
BHJurisdiction bh = new BHJurisdiction(admin, ...);

// Step 3: Register in registry (1 call)
registry.registerJurisdiction("BH", address(bh));

// Step 4: Enable on the token's compliance module (1 call)
multiCompliance.enableJurisdiction("BH");
// Done. No other changes needed.
```

---

## 4. Jurisdiction-by-Jurisdiction Reference

### Singapore (SG) — `SGJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | Securities and Futures Act (SFA), VCC Act 2018 |
| Investor tiers | RETAIL, ACCREDITED (SGD 2M assets / SGD 300K income), INSTITUTIONAL |
| Private placement | Section 274/275 exemption: max 50 investors |
| Public offer | Prospectus registered with MAS required |
| KYC attestations | SLA (land title), ACRA (corporate), MAS license, SingPass MyInfo |
| On-chain bodies | SLA e-Lodgment, ACRA Bizfile+, EAS adapters |

### Switzerland (CH) — `CHJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | FinSA, Federal DLT Act 2021, Code of Obligations Art. 973d (Registerwertrechte) |
| Investor tiers | RETAIL, SOPHISTICATED (opt-out), QUALIFIED (CHF 500K assets), INSTITUTIONAL |
| Token IS the right | Registerwertrecht — token = enforceable property right under Swiss law |
| Lock-up | Configurable; typically 12 months for private placements |
| KYC attestations | Handelsregister (zefix.ch), Grundbuch cantonal, FINMA license |

### UAE (AE) — `UAEJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | ADGM FSMR Investment Token Rules, DIFC Digital Assets Law 2024, VARA Rulebook |
| Investor tiers | RETAIL, PROFESSIONAL CLIENT (USD 1M assets / USD 200K income), INSTITUTIONAL |
| Sanctions | Pre-loaded: Iran, North Korea, Syria, Cuba, Russia (configurable) |
| Private placement | Max 200 investors (ADGM Rule 3.7.2) |
| On-chain courts | ADGM Courts (Practice Direction 2022), DIFC Digital Economy Court |
| KYC attestations | ADGM/DIFC court-authorized signers, EAS adapters |

### Liechtenstein (LI) — `LIJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | TVTG (Token and TT Service Provider Act), effective 1 Jan 2020 |
| Token Container Model | Token IS the legal right (Art. 4 TVTG). Transfer = transfer of right. |
| Investor tiers | RETAIL (with prospectus), SOPHISTICATED, QUALIFIED, INSTITUTIONAL |
| FMA registration | TT Service Provider registered with Liechtenstein FMA |
| EEA compliance | Subject to EU prospectus regulation for public offers |
| Special advantage | Most powerful legal recognition of tokens globally |

### Malaysia (MY) — `MYJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | Capital Markets and Services Act (CMSA), SC Digital Assets Guidelines 2023 |
| Investor tiers | RETAIL, SOPHISTICATED (RM 3M assets / RM 300K income), INSTITUTIONAL |
| Private placement | Max 200 investors, RM 50M/year cap (CMSA s.229A) |
| KYC attestations | SSM Bizfile+ (corporate), Pejabat Tanah (land), SC license |
| Agriculture tokens | Directly permitted under SC Digital Assets guidelines |

### United States (US) — `USJurisdiction.sol`

| Attribute | Detail |
|-----------|--------|
| Legal basis | Securities Act 1933, Reg D Rule 506(b)/(c), Reg S |
| Investor tiers | RETAIL (506b only, max 35), ACCREDITED ($1M assets / $200K income), INSTITUTIONAL (QIB) |
| Holding period | 12 months Rule 144 lock-up for Reg D tokens |
| Reg S | 40-day restricted period; US persons cannot receive |
| 506(b) vs 506(c) | 506(b): no general solicitation, some retail allowed; 506(c): accredited only, ads OK |

---

## 5. Recommended Asset Launch Configuration

### Real Estate (KL Tower, Malaysia + Singapore)
```solidity
// Deploy jurisdiction modules
MYJurisdiction myModule = new MYJurisdiction(admin, true, 200, 0);   // sophisticated only
SGJurisdiction sgModule = new SGJurisdiction(admin, true, 0);         // exempt offer, no cap

// Register in registry
registry.registerJurisdiction("MY", address(myModule));
registry.registerJurisdiction("SG", address(sgModule));

// Deploy multi-jurisdiction compliance
string[] memory juris = new string[](2);
juris[0] = "MY"; juris[1] = "SG";
MultiJurisdictionCompliance compliance = new MultiJurisdictionCompliance(
    address(registry), admin, juris
);

// Use as compliance module on RWA20Token
token.setComplianceModule(address(compliance));
```

### Agriculture (Durian Farm, open global retail)
```solidity
// No compliance needed — use NoCompliance
// But if adding attestation proof of ownership:
// Link PROPERTY_TITLE + AUDIT_CERTIFICATE attestations to "AG-MY-DURIAN-001"
registry.batchLinkAttestations("AG-MY-DURIAN-001", [titleUID, auditUID]);
```

---

## 6. Attestation Flow for Asset Launch

```
1. Issuer prepares legal documents:
   - Land title / corporate registration
   - Independent asset valuation report
   - Legal opinion confirming SPV structure

2. Trusted attestors issue on-chain attestations:
   - SLA authorized signer → EAS attestation (schema: PROPERTY_TITLE)
   - Big 4 auditor wallet  → EAS attestation (schema: AUDIT_CERTIFICATE)
   - Law firm wallet       → EAS attestation (schema: LEGAL_OPINION)

3. EASAttestationAdapter.bridgeAttestation() imports each attestation
   → LegalAttestationRegistry stores them with trusted-attestor verification

4. RWALaunchpad.launch() calls AssetProofRegistry.linkAttestation()
   → Attestation UIDs linked to assetId (e.g. "RE-MY-KL-001")

5. On-chain: registry.hasValidAttestation("RE-MY-KL-001", PROPERTY_TITLE) == true
   → Investors, regulators, courts can verify the legal chain
   → Traceable: token address → assetId → attestation UID → EAS UID → issuer address
              → off-chain document hash → IPFS document → real-world legal record
```

---

## 7. Security Considerations

**Attestor trust model:** Trust is governed by the `LegalAttestationRegistry` admin. Before deploying, the admin must carefully vet which addresses are granted trusted-attestor status for each jurisdiction+type combination. A compromised attestor can issue fraudulent attestations.

**EAS bridge trust:** The `EASAttestationAdapter` trusts the EAS contract for attestation validity. If EAS itself is compromised (unlikely given it is an audited, widely-used protocol), bridged attestations could be incorrect. The `isTrustedAttestor()` check provides a second layer — only pre-approved attestors' EAS attestations will be accepted.

**Jurisdiction module trust:** Each jurisdiction module is independently deployable. An upgrade to one module does not affect others. However, `MultiJurisdictionCompliance` reads modules via the `JurisdictionRegistry` — changing a registry entry changes compliance behavior for all tokens using that module.

**Holding period bypass:** The CH and US jurisdiction lock-up periods track `firstAcquisitionAt` via `onTransfer()`. This requires `RWA20Token` to call `complianceModule.onTransfer()` after successful transfers. Verify this is wired correctly in `RWA20Token._update()`.

**Sanctions list:** The UAE module pre-populates a sanctions list but this list must be maintained. Consider integrating a Chainlink oracle for real-time OFAC/UN sanctions data in production.
