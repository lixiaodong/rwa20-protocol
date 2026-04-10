'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  Protocol Dashboard — stats, fee structure, ecosystem overview
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOL_PHASES = [
  {
    phase: 'Phase 0',
    title: 'Bootstrap (Now)',
    status: 'active',
    icon: '🌱',
    color: 'border-green-500',
    features: [
      'All protocol fees = 0%',
      'MIT open-source license',
      'Public GitHub repository',
      'Core contracts audited',
    ],
    goal: 'Max adoption. Be the ERC20 for real-world assets.',
  },
  {
    phase: 'Phase 1',
    title: 'Community Growth',
    status: 'upcoming',
    icon: '🌿',
    color: 'border-blue-500',
    features: [
      'Issuance fee: 0.05%',
      'Distribution fee: 0.5%',
      'Governance multisig (5/9)',
      'Protocol grants program',
    ],
    goal: 'Fund development. Activate ecosystem grants.',
  },
  {
    phase: 'Phase 2',
    title: 'DAO Governance',
    status: 'planned',
    icon: '🌳',
    color: 'border-purple-500',
    features: [
      'RWA20 governance token launch',
      'On-chain fee parameter voting',
      'Jurisdiction module marketplace',
      'Enterprise SLA tier',
    ],
    goal: 'Decentralize control. Community-owned protocol.',
  },
  {
    phase: 'Phase 3',
    title: 'Global Standard',
    status: 'vision',
    icon: '🌍',
    color: 'border-yellow-500',
    features: [
      '20+ country jurisdictions',
      'Cross-chain bridging',
      'Institutional API (SaaS)',
      'ISO/IEC standardization push',
    ],
    goal: 'RWA20 = the SWIFT of tokenized assets.',
  },
];

const FEE_SCHEDULE = [
  {
    operation: 'Asset Issuance',
    phase0: '0%',
    phase1: '0.05% of NAV',
    phase2: '0.02–0.1% (tiered)',
    note: 'Charged once at launch. Enterprise discounts apply.',
    icon: '🚀',
  },
  {
    operation: 'Bonding Curve Buy',
    phase0: '0%',
    phase1: '0.5%',
    phase2: '0.1–0.5% (tiered)',
    note: 'On primary market fundraising only.',
    icon: '📈',
  },
  {
    operation: 'Revenue Distribution',
    phase0: '0%',
    phase1: '0.5% of payout',
    phase2: '0.2–0.5% (volume based)',
    note: 'Protocol takes a cut of USDC dividends distributed.',
    icon: '💰',
  },
  {
    operation: 'wRWA20 Swap',
    phase0: '0%',
    phase1: '0.03%',
    phase2: '0.01–0.03%',
    note: 'DEX trading fee on wrapped token transfers.',
    icon: '🔄',
  },
  {
    operation: 'Jurisdiction Module',
    phase0: 'Free (community)',
    phase1: 'Free (community)',
    phase2: 'Free (open) / $500/mo (certified)',
    note: 'Open-source modules free. Legal-opinion-certified modules = SaaS.',
    icon: '⚖️',
  },
];

const REVENUE_ROUTING = [
  { label: 'Protocol Treasury', pct: 70, desc: 'Development, audits, security bounties', color: 'bg-indigo-500' },
  { label: 'Ecosystem Fund', pct: 20, desc: 'Grants, liquidity mining, BD, integrations', color: 'bg-green-500' },
  { label: 'Governance Stakers', pct: 10, desc: 'RWA20 token holders who stake for governance', color: 'bg-yellow-500' },
];

const BUSINESS_TIERS = [
  {
    tier: 'Open Source',
    price: 'Free forever',
    icon: '🔓',
    color: 'border-gray-600',
    features: [
      'All core protocol contracts (MIT)',
      'Community jurisdiction modules',
      'Basic compliance (KYC/whitelist)',
      'Public GitHub + documentation',
      'Community Discord support',
    ],
    target: 'Developers, researchers, small issuers',
  },
  {
    tier: 'Standard',
    price: '$0 + protocol fees',
    icon: '⭐',
    color: 'border-indigo-500',
    highlight: true,
    features: [
      'Everything in Open Source',
      'Protocol-hosted deployment UI',
      'Certified EAS attestation schemas',
      'Pre-integrated KYC providers',
      'Email support (48h SLA)',
    ],
    target: 'Startups, asset managers launching first token',
  },
  {
    tier: 'Enterprise',
    price: 'Custom',
    icon: '🏦',
    color: 'border-yellow-500',
    features: [
      'Volume fee discounts (up to 80%)',
      'White-label deployment',
      'Custom jurisdiction modules with legal opinion',
      'Dedicated compliance dashboard (SaaS)',
      'API access + webhooks',
      'Direct regulatory liaison support',
      '4h SLA, dedicated account manager',
    ],
    target: 'Banks, fund managers, sovereign wealth funds',
  },
];

const ECOSYSTEM_STATS = [
  { label: 'Protocol contracts', value: '73', unit: 'deployed' },
  { label: 'Jurisdictions', value: '6', unit: 'live' },
  { label: 'Assets launched', value: '0', unit: '(testnet)' },
  { label: 'Total fees collected', value: '$0', unit: '(bootstrap)' },
];

export default function ProtocolPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-700 text-green-300 text-sm px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Phase 0 — Bootstrap (All fees: 0%)
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            RWA20 Protocol
          </h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            The open standard for tokenizing real-world assets — from Malaysian durian farms
            to Swiss Registerwertrechte. Start free, grow globally.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {ECOSYSTEM_STATS.map(s => (
            <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-sm text-gray-400">{s.unit}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Protocol Roadmap */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2">Protocol Roadmap</h2>
          <p className="text-gray-400 mb-8">Open source first. Build influence. Then monetize with the community.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROTOCOL_PHASES.map(p => (
              <div key={p.phase} className={`border rounded-xl p-5 ${p.color} ${p.status === 'active' ? 'bg-gray-800' : 'bg-gray-900'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{p.icon}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${p.status === 'active' ? 'bg-green-900 text-green-300' :
                      p.status === 'upcoming' ? 'bg-blue-900 text-blue-300' :
                      p.status === 'planned' ? 'bg-purple-900 text-purple-300' :
                      'bg-yellow-900 text-yellow-300'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-1">{p.phase}</div>
                <div className="font-bold mb-3">{p.title}</div>
                <ul className="space-y-1.5 mb-4">
                  {p.features.map(f => (
                    <li key={f} className="text-sm text-gray-300 flex items-start gap-1.5">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-400 italic border-t border-gray-700 pt-3">{p.goal}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Schedule */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2">Fee Schedule</h2>
          <p className="text-gray-400 mb-6">
            All fees start at zero. The <code className="bg-gray-800 px-1 rounded text-indigo-300">ProtocolFeeManager</code> contract
            enforces hard caps — issuance max 1%, distribution max 2%, swaps max 0.3%.
            Fee changes require governance vote.
          </p>
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-700 bg-gray-900">
                  <th className="text-left px-5 py-3">Operation</th>
                  <th className="text-left px-5 py-3">Phase 0 (Now)</th>
                  <th className="text-left px-5 py-3">Phase 1</th>
                  <th className="text-left px-5 py-3">Phase 2+</th>
                </tr>
              </thead>
              <tbody>
                {FEE_SCHEDULE.map((f, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span>{f.icon}</span>
                        <div>
                          <div className="font-medium">{f.operation}</div>
                          <div className="text-xs text-gray-500">{f.note}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-green-400 font-mono">{f.phase0}</td>
                    <td className="px-5 py-3 text-blue-400 font-mono">{f.phase1}</td>
                    <td className="px-5 py-3 text-purple-400 font-mono">{f.phase2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue routing */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2">Revenue Routing</h2>
          <p className="text-gray-400 mb-6">
            All fees flow through <code className="bg-gray-800 px-1 rounded text-indigo-300">ProtocolFeeManager.sweep()</code>.
            Splits are governance-configurable, currently set to 70/20/10.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REVENUE_ROUTING.map(r => (
              <div key={r.label} className="bg-gray-800 rounded-xl p-5">
                <div className={`text-4xl font-bold mb-2 ${r.color.replace('bg-', 'text-')}`}>
                  {r.pct}%
                </div>
                <div className="font-medium mb-1">{r.label}</div>
                <div className="text-sm text-gray-400">{r.desc}</div>
                <div className={`mt-4 h-2 rounded-full ${r.color} opacity-60`}
                  style={{ width: `${r.pct}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Business tiers */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2">Service Tiers</h2>
          <p className="text-gray-400 mb-8">
            Open-source core forever. Premium services for institutions who need legal certainty.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BUSINESS_TIERS.map(t => (
              <div key={t.tier} className={`border rounded-xl p-6 ${t.color} ${
                (t as any).highlight ? 'bg-indigo-900/20' : 'bg-gray-800'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{t.icon}</span>
                  {(t as any).highlight && (
                    <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded-full">Most Popular</span>
                  )}
                </div>
                <div className="font-bold text-xl mb-1">{t.tier}</div>
                <div className="text-indigo-400 font-medium mb-4">{t.price}</div>
                <ul className="space-y-2 mb-6">
                  {t.features.map(f => (
                    <li key={f} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 flex-shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 border-t border-gray-700 pt-3">
                  Best for: {t.target}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open source CTA */}
        <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Start Building on RWA20</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            All contracts are open-source under MIT license. Deploy on any EVM chain.
            Adding a new country takes 1 contract + 1 registry call.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/rwa20-protocol/rwa20"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl font-medium flex items-center gap-2"
            >
              <span>⭐</span> GitHub — Star the repo
            </a>
            <a
              href="/launch"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium"
            >
              🚀 Launch an Asset
            </a>
            <a
              href="/compliance"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl font-medium"
            >
              ⚖️ Set Up Compliance
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
