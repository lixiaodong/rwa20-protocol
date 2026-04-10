'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, zeroAddress } from 'viem';

// ─────────────────────────────────────────────────────────────────────────────
//  Jurisdiction Compliance Wizard
//
//  Multi-step wizard that helps issuers:
//  1. Select which jurisdictions to enable for their token
//  2. Register investors from each jurisdiction
//  3. Preview multi-jurisdiction compliance configuration
// ─────────────────────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    regulator: 'MAS — Securities and Futures Act',
    tiers: ['RETAIL', 'ACCREDITED (SGD 2M/300K)', 'INSTITUTIONAL'],
    keyRule: 'Max 50 investors in exempt offer (s.274/275)',
    color: 'from-red-500 to-red-700',
    legalBodies: ['Singapore Land Authority (SLA)', 'ACRA Bizfile+', 'MAS Licensing'],
    status: 'live',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    regulator: 'FINMA — FinSA / DLT Act (Registerwertrechte)',
    tiers: ['RETAIL', 'SOPHISTICATED', 'QUALIFIED (CHF 500K)', 'INSTITUTIONAL'],
    keyRule: 'Token IS the legal right (Art. 973d CO). Lock-up configurable.',
    color: 'from-red-600 to-gray-700',
    legalBodies: ['Handelsregister (zefix.ch)', 'Grundbuch (cantonal)', 'FINMA License'],
    status: 'live',
  },
  {
    code: 'AE',
    name: 'UAE',
    flag: '🇦🇪',
    regulator: 'ADGM FSRA / VARA — Investment Token Rules',
    tiers: ['RETAIL', 'PROFESSIONAL CLIENT (USD 1M/200K)', 'INSTITUTIONAL'],
    keyRule: 'ADGM/DIFC court orders accepted on-chain. Max 200 investors.',
    color: 'from-green-600 to-black',
    legalBodies: ['ADGM Courts', 'DIFC Digital Economy Court', 'VARA VASP Register'],
    status: 'live',
  },
  {
    code: 'LI',
    name: 'Liechtenstein',
    flag: '🇱🇮',
    regulator: 'FMA — TVTG Token Container Model',
    tiers: ['RETAIL', 'SOPHISTICATED', 'QUALIFIED', 'INSTITUTIONAL'],
    keyRule: 'Token Container Model: owning token = owning the right (TVTG Art. 4)',
    color: 'from-blue-700 to-red-700',
    legalBodies: ['FMA TT Register', 'EEA Prospectus filing', 'Notary Office'],
    status: 'live',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    regulator: 'SC — CMSA / Digital Assets Guidelines',
    tiers: ['RETAIL', 'SOPHISTICATED (RM 3M/300K)', 'INSTITUTIONAL'],
    keyRule: 'Agriculture tokens directly permitted. Max 200 investors, RM 50M/yr cap.',
    color: 'from-blue-600 to-yellow-500',
    legalBodies: ['SSM Bizfile+', 'Pejabat Tanah (Land Office)', 'SC License'],
    status: 'live',
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    regulator: 'SEC — Reg D 506(b)/(c) / Reg S',
    tiers: ['RETAIL (506b only, max 35)', 'ACCREDITED ($1M/$200K)', 'INSTITUTIONAL (QIB $100M)'],
    keyRule: '12-month Rule 144 hold period. Reg S: 40-day restricted period.',
    color: 'from-blue-700 to-red-600',
    legalBodies: ['SEC EDGAR', 'FINRA BrokerCheck', 'State Securities Regulator'],
    status: 'live',
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    regulator: 'FSA — Financial Instruments Act (STO)',
    tiers: ['RETAIL', 'PROFESSIONAL', 'INSTITUTIONAL'],
    keyRule: 'STO (Security Token Offering) framework. Type 1 FIBO license required.',
    color: 'from-red-600 to-white',
    legalBodies: ['FSA J-STO Register', 'Legal Affairs Bureau'],
    status: 'coming_soon',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    regulator: 'FCA — Digital Securities Sandbox / FSMA',
    tiers: ['RETAIL', 'HIGH NET WORTH', 'SOPHISTICATED', 'INSTITUTIONAL'],
    keyRule: 'Digital Securities Sandbox (2024). Tokenized securities recognized.',
    color: 'from-blue-700 to-red-700',
    legalBodies: ["FCA Register", "HM Land Registry"],
    status: 'coming_soon',
  },
];

const INVESTOR_CLASSES: Record<string, { label: string; value: number }[]> = {
  SG: [{ label: 'Retail', value: 1 }, { label: 'Accredited', value: 3 }, { label: 'Institutional', value: 6 }],
  CH: [{ label: 'Retail', value: 1 }, { label: 'Sophisticated', value: 2 }, { label: 'Qualified', value: 4 }, { label: 'Institutional', value: 6 }],
  AE: [{ label: 'Retail', value: 1 }, { label: 'Professional', value: 3 }, { label: 'Institutional', value: 6 }],
  LI: [{ label: 'Retail', value: 1 }, { label: 'Sophisticated', value: 2 }, { label: 'Qualified', value: 4 }, { label: 'Institutional', value: 6 }],
  MY: [{ label: 'Retail', value: 1 }, { label: 'Sophisticated', value: 2 }, { label: 'Institutional', value: 6 }],
  US: [{ label: 'Retail (506b)', value: 1 }, { label: 'Accredited', value: 3 }, { label: 'Institutional (QIB)', value: 6 }],
};

type Step = 'select' | 'configure' | 'investors' | 'review';

export default function CompliancePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>('select');
  const [selectedJuris, setSelectedJuris] = useState<string[]>([]);
  const [tokenAddress, setTokenAddress] = useState('');
  const [newInvestor, setNewInvestor] = useState('');
  const [newInvestorClass, setNewInvestorClass] = useState(3);
  const [newInvestorJuris, setNewInvestorJuris] = useState('SG');
  const [registeredInvestors, setRegisteredInvestors] = useState<{
    address: string; juris: string; class: number;
  }[]>([]);

  const toggleJuris = (code: string) => {
    const j = JURISDICTIONS.find(j => j.code === code);
    if (j?.status === 'coming_soon') return;
    setSelectedJuris(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const addInvestor = () => {
    if (!newInvestor || !newInvestor.startsWith('0x')) return;
    setRegisteredInvestors(prev => [...prev, {
      address: newInvestor,
      juris: newInvestorJuris,
      class: newInvestorClass,
    }]);
    setNewInvestor('');
  };

  const classLabel = (juris: string, cls: number) => {
    return INVESTOR_CLASSES[juris]?.find(c => c.value === cls)?.label || String(cls);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚖️</span>
            <h1 className="text-3xl font-bold">Jurisdiction Compliance</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Configure multi-jurisdiction compliance for your RWA20 token.
            A single token can be sold to investors in multiple countries simultaneously.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-10">
          {(['select', 'configure', 'investors', 'review'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s ? 'bg-indigo-600' :
                  (['select', 'configure', 'investors', 'review'].indexOf(step) > i) ? 'bg-green-600' : 'bg-gray-700'}`}>
                {i + 1}
              </div>
              <span className={`text-sm ${step === s ? 'text-white' : 'text-gray-500'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 3 && <div className="w-8 h-px bg-gray-700" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Jurisdictions */}
        {step === 'select' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Select Jurisdictions</h2>
            <p className="text-gray-400 mb-6">
              Choose which countries your token will be available in. Investors only need KYC
              in one jurisdiction to qualify — OR logic applies across all selected jurisdictions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {JURISDICTIONS.map(j => (
                <div
                  key={j.code}
                  onClick={() => toggleJuris(j.code)}
                  className={`relative rounded-xl border p-5 cursor-pointer transition-all
                    ${j.status === 'coming_soon' ? 'opacity-40 cursor-not-allowed border-gray-700' :
                      selectedJuris.includes(j.code)
                        ? 'border-indigo-500 bg-indigo-900/20'
                        : 'border-gray-700 hover:border-gray-500'}`}
                >
                  {j.status === 'coming_soon' && (
                    <div className="absolute top-3 right-3 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                      Coming Soon
                    </div>
                  )}
                  {selectedJuris.includes(j.code) && (
                    <div className="absolute top-3 right-3 text-green-400 text-xl">✓</div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{j.flag}</span>
                    <div>
                      <div className="font-bold">{j.name}</div>
                      <div className="text-xs text-gray-400">{j.code}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{j.regulator}</div>
                  <div className="text-xs text-gray-500 line-clamp-2">{j.keyRule}</div>
                </div>
              ))}
            </div>

            {selectedJuris.length > 0 && (
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 mb-6">
                <div className="text-sm font-medium text-indigo-300 mb-2">
                  Selected: {selectedJuris.join(', ')}
                </div>
                <div className="text-xs text-gray-400">
                  Investors from any of these jurisdictions can receive your token.
                  MultiJurisdictionCompliance will be deployed as the compliance module.
                </div>
              </div>
            )}

            <button
              disabled={selectedJuris.length === 0}
              onClick={() => setStep('configure')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Configure Token */}
        {step === 'configure' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Configure Token</h2>
            <div className="space-y-4 max-w-lg mb-8">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Token Address (if already deployed)</label>
                <input
                  value={tokenAddress}
                  onChange={e => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Leave blank to deploy a new token in the next step
                </div>
              </div>

              {/* Jurisdiction-specific config */}
              {selectedJuris.map(code => {
                const j = JURISDICTIONS.find(j => j.code === code)!;
                return (
                  <div key={code} className="bg-gray-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{j.flag}</span>
                      <div className="font-medium">{j.name} Configuration</div>
                    </div>
                    <div className="space-y-3">
                      {code === 'SG' && (
                        <label className="flex items-center gap-3 text-sm">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span>Section 274/275 exempt offer (min class: Accredited)</span>
                        </label>
                      )}
                      {code === 'CH' && (
                        <label className="flex items-center gap-3 text-sm">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span>Qualified Investor only (FinSA Art. 36)</span>
                        </label>
                      )}
                      {code === 'AE' && (
                        <label className="flex items-center gap-3 text-sm">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span>Professional Client only (ADGM Rule 3.7.2)</span>
                        </label>
                      )}
                      {code === 'US' && (
                        <div className="text-sm">
                          <div className="text-gray-400 mb-2">Exemption Type</div>
                          <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                            <option>Reg D 506(b) — Private, up to 35 retail</option>
                            <option>Reg D 506(c) — Accredited only, ads allowed</option>
                            <option>Reg S — Offshore investors only</option>
                          </select>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        {j.legalBodies.map(lb => (
                          <span key={lb} className="inline-block bg-gray-700 rounded px-2 py-0.5 mr-1 mb-1">{lb}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('select')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium">
                ← Back
              </button>
              <button onClick={() => setStep('investors')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Register Investors */}
        {step === 'investors' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Register Investors</h2>
            <p className="text-gray-400 text-sm mb-6">
              Add wallet addresses and their investor classification. This calls
              <code className="mx-1 bg-gray-800 px-1 rounded text-indigo-300">registerInvestor()</code>
              on each jurisdiction module.
            </p>

            <div className="bg-gray-800 rounded-xl p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Wallet Address</label>
                  <input
                    value={newInvestor}
                    onChange={e => setNewInvestor(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Jurisdiction</label>
                  <select
                    value={newInvestorJuris}
                    onChange={e => setNewInvestorJuris(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    {selectedJuris.map(c => (
                      <option key={c} value={c}>
                        {JURISDICTIONS.find(j => j.code === c)?.flag} {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Investor Class</label>
                  <select
                    value={newInvestorClass}
                    onChange={e => setNewInvestorClass(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    {(INVESTOR_CLASSES[newInvestorJuris] || []).map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={addInvestor}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium"
              >
                + Add Investor
              </button>
            </div>

            {registeredInvestors.length > 0 && (
              <div className="bg-gray-800 rounded-xl overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-gray-700 text-sm font-medium">
                  Investors to Register ({registeredInvestors.length})
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-700">
                      <th className="text-left px-5 py-2">Address</th>
                      <th className="text-left px-5 py-2">Jurisdiction</th>
                      <th className="text-left px-5 py-2">Class</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {registeredInvestors.map((inv, i) => (
                      <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-5 py-2 font-mono text-xs">
                          {inv.address.slice(0, 8)}...{inv.address.slice(-6)}
                        </td>
                        <td className="px-5 py-2">
                          {JURISDICTIONS.find(j => j.code === inv.juris)?.flag} {inv.juris}
                        </td>
                        <td className="px-5 py-2">{classLabel(inv.juris, inv.class)}</td>
                        <td className="px-5 py-2 text-right">
                          <button
                            onClick={() => setRegisteredInvestors(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('configure')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium">
                ← Back
              </button>
              <button onClick={() => setStep('review')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium">
                Review & Deploy →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Review & Deploy</h2>

            <div className="space-y-4 mb-8">
              <div className="bg-gray-800 rounded-xl p-5">
                <div className="text-sm font-medium text-gray-400 mb-3">Compliance Configuration</div>
                <div className="text-sm mb-2">
                  Contract: <code className="bg-gray-700 px-2 py-0.5 rounded text-indigo-300">MultiJurisdictionCompliance</code>
                </div>
                <div className="text-sm text-gray-400">
                  Logic: OR — investor qualifies if approved in <strong className="text-white">any one</strong> of:
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedJuris.map(code => {
                    const j = JURISDICTIONS.find(j => j.code === code)!;
                    return (
                      <span key={code} className="flex items-center gap-1.5 bg-indigo-900/40 border border-indigo-500/30 px-3 py-1 rounded-full text-sm">
                        <span>{j.flag}</span>
                        <span>{j.name}</span>
                        <span className="text-xs text-indigo-400">({code})</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-5">
                <div className="text-sm font-medium text-gray-400 mb-3">Investor Registrations</div>
                <div className="text-2xl font-bold">{registeredInvestors.length}</div>
                <div className="text-sm text-gray-400">investors will be registered on-chain</div>
              </div>

              <div className="bg-gray-800 rounded-xl p-5">
                <div className="text-sm font-medium text-gray-400 mb-3">Contracts to Deploy</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    <code className="text-indigo-300">MultiJurisdictionCompliance.sol</code>
                    <span className="text-gray-400">(1 deployment)</span>
                  </div>
                  {selectedJuris.map(code => (
                    <div key={code} className="flex items-center gap-2 pl-4">
                      <span className="text-blue-400">→</span>
                      <code className="text-indigo-300">{code}Jurisdiction.sol</code>
                      <span className="text-gray-400">(1 deployment per jurisdiction)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
                <div className="text-amber-400 font-medium text-sm mb-1">⚠️ On-Chain Action Required</div>
                <div className="text-sm text-gray-300">
                  Deploying these contracts requires your wallet signature. Each jurisdiction module
                  and the compliance contract will be deployed in separate transactions.
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('investors')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium">
                ← Back
              </button>
              {isConnected ? (
                <button className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-medium">
                  🚀 Deploy Compliance Contracts
                </button>
              ) : (
                <button className="px-8 py-3 bg-gray-600 rounded-xl font-medium cursor-not-allowed">
                  Connect Wallet to Deploy
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
