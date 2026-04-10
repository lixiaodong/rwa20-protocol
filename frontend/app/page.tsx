"use client";

import { useReadContract }    from "wagmi";
import { ArrowRight, Zap, Shield, TrendingUp, Globe } from "lucide-react";
import Link                   from "next/link";
import { CONTRACTS, LAUNCHPAD_ABI } from "../lib/contracts";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub?: string
}) {
  return (
    <div className="stat-card">
      <span className="text-2xl mb-1">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value gradient-text">{value}</div>
      {sub && <div className="text-dark-muted text-xs">{sub}</div>}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, desc }: {
  icon: React.ElementType; title: string; desc: string
}) {
  return (
    <div className="card hover:border-brand-700 transition-colors">
      <div className="p-2 w-10 h-10 rounded-lg bg-brand-900/50 mb-4 flex items-center justify-center">
        <Icon size={20} className="text-brand-400" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-dark-muted text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: assetCount } = useReadContract({
    address: CONTRACTS.LAUNCHPAD,
    abi:     LAUNCHPAD_ABI,
    functionName: "assetCount",
  });

  return (
    <div className="space-y-16">

      {/* Hero */}
      <section className="text-center pt-12 pb-8">
        <div className="inline-flex items-center gap-2 badge badge-green mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
          Live on Localhost · Testnet Ready
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Tokenize Any
          <br />
          <span className="gradient-text">Real World Asset</span>
        </h1>

        <p className="text-dark-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          RWA20 is a modular protocol for issuing, trading, and distributing
          revenue from tokenized real estate, agriculture, gold, and debt instruments.
          One click. Production ready.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/launch" className="btn-primary flex items-center gap-2">
            Launch an Asset <ArrowRight size={16} />
          </Link>
          <Link href="/assets" className="btn-secondary flex items-center gap-2">
            Explore Assets
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="🏗️"
          label="Assets Launched"
          value={assetCount?.toString() ?? "0"}
          sub="via RWA20 protocol"
        />
        <StatCard
          icon="🌳"
          label="Asset Types"
          value="4"
          sub="RE · Agriculture · Gold · Debt"
        />
        <StatCard
          icon="⚡"
          label="Deploy Time"
          value="1 tx"
          sub="token + compliance + oracle"
        />
        <StatCard
          icon="🔒"
          label="Compliance Modules"
          value="2"
          sub="KYC gated · Open trading"
        />
      </section>

      {/* Features */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Protocol Features</h2>
        <p className="text-dark-muted mb-8">Everything you need to tokenize and manage real-world assets</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={Zap}
            title="One-Click Launchpad"
            desc="Deploy a complete RWA20 stack — token, compliance, oracle, revenue distributor, and DEX wrapper — in a single transaction."
          />
          <FeatureCard
            icon={Shield}
            title="Pluggable Compliance"
            desc="Swap between KYC/jurisdiction-gated compliance and open trading at any time. Fully modular, no re-deployment needed."
          />
          <FeatureCard
            icon={TrendingUp}
            title="Revenue Distribution"
            desc="Snapshot-based USDC payouts for all token holders. Rental income, crop yields, bond coupons — distribute any periodic revenue."
          />
          <FeatureCard
            icon={Globe}
            title="Oracle-Driven Valuation"
            desc="Role-restricted oracle for real-time NAV and yield data. Supports complex agriculture cycles like durian harvest seasons."
          />
        </div>
      </section>

      {/* Asset templates */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Asset Templates</h2>
        <p className="text-dark-muted mb-8">Pre-configured templates for common real-world asset types</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Real Estate */}
          <div className="card border-blue-700/40 hover:border-blue-500 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🏢</span>
              <div>
                <div className="font-bold text-lg">Real Estate</div>
                <div className="text-dark-muted text-sm">Commercial, residential, REIT</div>
              </div>
              <span className="ml-auto badge badge-blue">KYC Required</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div>
                <div className="stat-label">Income</div>
                <div>Rental yield</div>
              </div>
              <div>
                <div className="stat-label">Duration</div>
                <div>3–10 years</div>
              </div>
              <div>
                <div className="stat-label">Risk</div>
                <div className="text-yellow-400">Medium</div>
              </div>
            </div>
            <div className="text-dark-muted text-xs">Example: KL Tower Office, Malaysia — 6.5% rental yield</div>
          </div>

          {/* Agriculture */}
          <div className="card border-green-700/40 hover:border-green-500 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🌳</span>
              <div>
                <div className="font-bold text-lg">Agriculture</div>
                <div className="text-dark-muted text-sm">Farms, orchards, crop yield</div>
              </div>
              <span className="ml-auto badge badge-green">Open Trading</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div>
                <div className="stat-label">Income</div>
                <div>Crop yield</div>
              </div>
              <div>
                <div className="stat-label">Duration</div>
                <div>3–5 years</div>
              </div>
              <div>
                <div className="stat-label">Risk</div>
                <div className="text-red-400">High</div>
              </div>
            </div>
            <div className="text-dark-muted text-xs">Example: Musang King Durian Farm, Pahang — ~18% yield</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="card text-center border-brand-700/50 bg-gradient-to-b from-brand-900/20 to-transparent">
        <h2 className="text-2xl font-bold mb-3">Ready to tokenize?</h2>
        <p className="text-dark-muted mb-6">
          Deploy your first RWA20 token in under 60 seconds.
        </p>
        <Link href="/launch" className="btn-primary inline-flex items-center gap-2">
          Launch Your Asset <ArrowRight size={16} />
        </Link>
      </section>

    </div>
  );
}
