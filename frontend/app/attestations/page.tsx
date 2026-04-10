'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Attestation Explorer
//
//  Browse on-chain legal proofs linked to RWA20 assets.
//  Sources: EAS, Kleros, ADGM/DIFC courts, FMA Liechtenstein, SLA, ACRA.
// ─────────────────────────────────────────────────────────────────────────────

type AttestationType =
  | 'PROPERTY_TITLE'
  | 'CORPORATE_RECORD'
  | 'COURT_ORDER'
  | 'AUDIT_CERTIFICATE'
  | 'KYC_VERIFICATION'
  | 'REGULATORY_APPROVAL'
  | 'VALUATION_REPORT'
  | 'CUSTODY_PROOF'
  | 'LEGAL_OPINION';

interface Attestation {
  uid: string;
  type: AttestationType;
  assetId: string;
  assetName: string;
  attestor: string;
  legalBody: string;
  jurisdiction: string;
  externalRef: string;
  documentHash: string;
  ipfsCID: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  source: 'EAS' | 'Kleros' | 'Native';
}

// Mock attestations — in production, these come from LegalAttestationRegistry
const MOCK_ATTESTATIONS: Attestation[] = [
  {
    uid: '0x7f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a',
    type: 'PROPERTY_TITLE',
    assetId: 'RE-MY-KL-001',
    assetName: 'KL Tower Commercial Units',
    attestor: '0x1234567890abcdef1234567890abcdef12345678',
    legalBody: 'Singapore Land Authority (SLA)',
    jurisdiction: 'MY',
    externalRef: 'GRN-WP-12345-2024',
    documentHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    ipfsCID: 'QmXjD7ZrQY1mLe9EqKFNrA2c8wXy5tZ3kP6mH4dN8vR2sT',
    issuedAt: 1704067200,
    expiresAt: 0,
    revoked: false,
    source: 'EAS',
  },
  {
    uid: '0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
    type: 'AUDIT_CERTIFICATE',
    assetId: 'RE-MY-KL-001',
    assetName: 'KL Tower Commercial Units',
    attestor: '0xabcdef1234567890abcdef1234567890abcdef12',
    legalBody: 'KPMG Malaysia (Registered Auditor)',
    jurisdiction: 'MY',
    externalRef: 'KPMG-AUDIT-2024-KL-0042',
    documentHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fe',
    ipfsCID: 'QmYkE8ArPX2nMe0FrLGOsB3d9wZa6uA4jQ7nI5eO9wS3uV',
    issuedAt: 1706745600,
    expiresAt: 1738281600,
    revoked: false,
    source: 'EAS',
  },
  {
    uid: '0x0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d',
    type: 'CORPORATE_RECORD',
    assetId: 'RE-MY-KL-001',
    assetName: 'KL Tower Commercial Units',
    attestor: '0x2345678901abcdef2345678901abcdef23456789',
    legalBody: 'Suruhanjaya Syarikat Malaysia (SSM)',
    jurisdiction: 'MY',
    externalRef: 'SSM-202412345A',
    documentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
    ipfsCID: 'QmZlF9BsQY3oNf1GsMOtC4e0xAb7vB5kR8oJ6fP0xT4vW',
    issuedAt: 1703462400,
    expiresAt: 0,
    revoked: false,
    source: 'Native',
  },
  {
    uid: '0x1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    type: 'COURT_ORDER',
    assetId: 'AG-MY-DURIAN-001',
    assetName: 'Musang King Durian Farm',
    attestor: '0x3456789012abcdef3456789012abcdef34567890',
    legalBody: 'ADGM Courts (Practice Direction 2022)',
    jurisdiction: 'AE',
    externalRef: 'ADGM-CASE-2024-CRYPTO-0089',
    documentHash: '0x234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123',
    ipfsCID: 'QmWmH0CrNZ4pOf2HtLNuD5f1yBc8wC6lS9pK7gQ1yU5xX',
    issuedAt: 1709337600,
    expiresAt: 0,
    revoked: false,
    source: 'Native',
  },
  {
    uid: '0x2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f',
    type: 'REGULATORY_APPROVAL',
    assetId: 'LI-RE-VADUZ-001',
    assetName: 'Vaduz Business Center (LI)',
    attestor: '0x456789012bcdef3456789012bcdef345678901a',
    legalBody: 'Liechtenstein FMA (TVTG TT Register)',
    jurisdiction: 'LI',
    externalRef: 'FMA-TTSP-2024-0023',
    documentHash: '0x34567890bcdef1234567890bcdef1234567890bcdef1234567890bcdef12345678',
    ipfsCID: 'QmVnI1DqOA5qPg3IuMOvE6g2zCd9xD7mT0qL8hR2zV6yY',
    issuedAt: 1711929600,
    expiresAt: 1743465600,
    revoked: false,
    source: 'Native',
  },
];

const TYPE_COLORS: Record<AttestationType, string> = {
  PROPERTY_TITLE:     'bg-blue-900/40 text-blue-300 border-blue-700',
  CORPORATE_RECORD:   'bg-purple-900/40 text-purple-300 border-purple-700',
  COURT_ORDER:        'bg-red-900/40 text-red-300 border-red-700',
  AUDIT_CERTIFICATE:  'bg-green-900/40 text-green-300 border-green-700',
  KYC_VERIFICATION:   'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  REGULATORY_APPROVAL:'bg-indigo-900/40 text-indigo-300 border-indigo-700',
  VALUATION_REPORT:   'bg-teal-900/40 text-teal-300 border-teal-700',
  CUSTODY_PROOF:      'bg-orange-900/40 text-orange-300 border-orange-700',
  LEGAL_OPINION:      'bg-pink-900/40 text-pink-300 border-pink-700',
};

const TYPE_ICONS: Record<AttestationType, string> = {
  PROPERTY_TITLE:      '🏠',
  CORPORATE_RECORD:    '🏢',
  COURT_ORDER:         '⚖️',
  AUDIT_CERTIFICATE:   '🔍',
  KYC_VERIFICATION:    '🪪',
  REGULATORY_APPROVAL: '📋',
  VALUATION_REPORT:    '💰',
  CUSTODY_PROOF:       '🔐',
  LEGAL_OPINION:       '📜',
};

const SOURCE_COLORS: Record<string, string> = {
  EAS:    'bg-violet-900/40 text-violet-300',
  Kleros: 'bg-red-900/40 text-red-300',
  Native: 'bg-gray-700 text-gray-300',
};

const FLAGS: Record<string, string> = {
  SG: '🇸🇬', CH: '🇨🇭', AE: '🇦🇪', LI: '🇱🇮', MY: '🇲🇾', US: '🇺🇸',
};

function shortenHash(h: string) {
  return h.slice(0, 10) + '...' + h.slice(-8);
}

function formatDate(ts: number) {
  if (ts === 0) return 'Never';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AttestationsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterJuris, setFilterJuris] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = MOCK_ATTESTATIONS.filter(a => {
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (filterJuris !== 'ALL' && a.jurisdiction !== filterJuris) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.assetId.toLowerCase().includes(q) ||
             a.assetName.toLowerCase().includes(q) ||
             a.legalBody.toLowerCase().includes(q) ||
             a.externalRef.toLowerCase().includes(q);
    }
    return true;
  });

  const types = ['ALL', ...Array.from(new Set(MOCK_ATTESTATIONS.map(a => a.type)))];
  const jurisCodes = ['ALL', ...Array.from(new Set(MOCK_ATTESTATIONS.map(a => a.jurisdiction)))];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔗</span>
            <h1 className="text-3xl font-bold">Legal Attestation Explorer</h1>
          </div>
          <p className="text-gray-400 text-lg">
            On-chain legal proofs linking RWA20 assets to real-world legal relationships.
            Sources: EAS, Kleros, ADGM Courts, Liechtenstein FMA, Singapore SLA, and more.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Attestations', value: MOCK_ATTESTATIONS.length, icon: '📋' },
            { label: 'Assets Covered', value: new Set(MOCK_ATTESTATIONS.map(a => a.assetId)).size, icon: '🏗️' },
            { label: 'Jurisdictions', value: new Set(MOCK_ATTESTATIONS.map(a => a.jurisdiction)).size, icon: '🌏' },
            { label: 'EAS Bridged', value: MOCK_ATTESTATIONS.filter(a => a.source === 'EAS').length, icon: '⛓️' },
          ].map(s => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by asset, legal body, reference..."
            className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
          >
            {types.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t.replace('_', ' ')}</option>)}
          </select>
          <select
            value={filterJuris}
            onChange={e => setFilterJuris(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
          >
            {jurisCodes.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Jurisdictions' : `${FLAGS[c] || ''} ${c}`}</option>
            ))}
          </select>
        </div>

        {/* Attestation cards */}
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.uid} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <div
                className="flex items-start gap-4 p-5 cursor-pointer hover:bg-gray-700/30 transition"
                onClick={() => setExpanded(expanded === a.uid ? null : a.uid)}
              >
                {/* Type icon + badge */}
                <div className="flex-shrink-0">
                  <div className="text-2xl mb-2">{TYPE_ICONS[a.type]}</div>
                  <div className={`text-xs border rounded px-1.5 py-0.5 ${TYPE_COLORS[a.type]}`}>
                    {a.type.replace('_', ' ')}
                  </div>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.assetName}</div>
                      <div className="text-xs text-gray-400">{a.assetId}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[a.source]}`}>
                        {a.source}
                      </span>
                      <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">
                        {FLAGS[a.jurisdiction]} {a.jurisdiction}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.revoked ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                        {a.revoked ? 'Revoked' : 'Valid'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    <span className="text-gray-500">Issued by:</span> {a.legalBody}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ref: {a.externalRef} · Issued: {formatDate(a.issuedAt)} · Expires: {formatDate(a.expiresAt)}
                  </div>
                </div>

                <div className="text-gray-500 flex-shrink-0">
                  {expanded === a.uid ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === a.uid && (
                <div className="border-t border-gray-700 px-5 py-4 space-y-3 bg-gray-900/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Attestation UID</div>
                      <div className="font-mono text-xs bg-gray-800 px-3 py-2 rounded break-all">
                        {a.uid}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Attestor Address</div>
                      <div className="font-mono text-xs bg-gray-800 px-3 py-2 rounded">
                        {a.attestor}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Document Hash (keccak256)</div>
                      <div className="font-mono text-xs bg-gray-800 px-3 py-2 rounded break-all">
                        {shortenHash(a.documentHash)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">IPFS Document</div>
                      <a
                        href={`https://ipfs.io/ipfs/${a.ipfsCID}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs bg-gray-800 px-3 py-2 rounded block text-indigo-400 hover:text-indigo-300 truncate"
                      >
                        {a.ipfsCID}
                      </a>
                    </div>
                  </div>

                  {/* Trust chain visualization */}
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-3 font-medium">Trust Chain</div>
                    <div className="flex items-center gap-2 text-xs overflow-x-auto">
                      {[
                        { label: 'Token', val: a.assetId, icon: '🪙' },
                        { label: 'Registry', val: 'LegalAttestationRegistry', icon: '📦' },
                        { label: 'Attestation', val: shortenHash(a.uid), icon: '🔗' },
                        { label: 'Attestor', val: a.legalBody, icon: '🏛️' },
                        { label: 'Document', val: a.externalRef, icon: '📄' },
                      ].map((item, i, arr) => (
                        <div key={i} className="flex items-center gap-2 flex-shrink-0">
                          <div className="bg-gray-700 rounded-lg px-3 py-2 text-center">
                            <div className="text-lg">{item.icon}</div>
                            <div className="text-gray-400">{item.label}</div>
                            <div className="font-medium max-w-24 truncate">{item.val}</div>
                          </div>
                          {i < arr.length - 1 && <span className="text-gray-600">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {a.source === 'EAS' && (
                      <a
                        href={`https://easscan.org/attestation/view/${a.uid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-violet-900/40 border border-violet-700 text-violet-300 px-3 py-1.5 rounded-lg hover:bg-violet-800/40"
                      >
                        View on EAS Scan ↗
                      </a>
                    )}
                    <a
                      href={`https://ipfs.io/ipfs/${a.ipfsCID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-600"
                    >
                      View Document ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <div className="text-4xl mb-4">🔍</div>
              <div>No attestations found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
