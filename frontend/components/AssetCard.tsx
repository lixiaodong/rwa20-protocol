"use client";

import Link               from "next/link";
import { ASSET_TYPES, formatUSDC } from "../lib/contracts";
import clsx               from "clsx";

interface Asset {
  token:       string;
  assetType:   number;
  assetId:     string;
  issuer:      string;
  launchedAt:  bigint;
  active:      boolean;
  bondingCurve?: string;
  // Enriched data (loaded from chain)
  name?:       string;
  symbol?:     string;
  navUSD?:     bigint;
  yieldBps?:   bigint;
  totalSupply?: bigint;
}

const ASSET_ICONS  = ["🏢", "🌳", "🥇", "📜"];
const ASSET_COLORS = [
  "bg-blue-900/40   border-blue-700/50  text-blue-300",
  "bg-green-900/40  border-green-700/50 text-green-300",
  "bg-yellow-900/40 border-yellow-700/50 text-yellow-300",
  "bg-purple-900/40 border-purple-700/50 text-purple-300",
];

export default function AssetCard({ asset }: { asset: Asset }) {
  const typeIdx  = asset.assetType ?? 0;
  const icon     = ASSET_ICONS[typeIdx]  ?? "📦";
  const typeName = ASSET_TYPES[typeIdx]  ?? "Unknown";
  const colorCls = ASSET_COLORS[typeIdx] ?? ASSET_COLORS[0];
  const yieldPct = asset.yieldBps ? (Number(asset.yieldBps) / 100).toFixed(2) : null;

  return (
    <Link href={`/assets/${asset.token}`}>
      <div className={clsx(
        "card border cursor-pointer hover:border-brand-500 transition-all hover:-translate-y-0.5",
        "hover:shadow-lg hover:shadow-brand-900/20 group"
      )}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="font-bold text-lg group-hover:text-brand-400 transition-colors">
                {asset.symbol ?? asset.assetId}
              </div>
              <div className="text-dark-muted text-sm">{asset.name ?? "—"}</div>
            </div>
          </div>
          <span className={clsx("badge border text-xs", colorCls)}>{typeName}</span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="stat-label">NAV</div>
            <div className="font-semibold">
              {asset.navUSD ? formatUSDC(asset.navUSD, 18) : "—"}
            </div>
          </div>
          <div>
            <div className="stat-label">Annual Yield</div>
            <div className={clsx("font-semibold", yieldPct ? "text-brand-400" : "text-dark-muted")}>
              {yieldPct ? `${yieldPct}%` : "—"}
            </div>
          </div>
          <div>
            <div className="stat-label">Total Supply</div>
            <div className="font-semibold font-mono text-sm">
              {asset.totalSupply
                ? Number(asset.totalSupply / BigInt(10 ** 18)).toLocaleString()
                : "—"}
            </div>
          </div>
          <div>
            <div className="stat-label">Compliance</div>
            <div className="text-sm">
              {asset.bondingCurve && asset.bondingCurve !== "0x0000000000000000000000000000000000000000"
                ? <span className="text-brand-400">Curve Active</span>
                : <span className="text-dark-muted">Direct</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-dark-border flex items-center justify-between">
          <span className="text-dark-muted text-xs font-mono">
            {asset.token.slice(0, 8)}…{asset.token.slice(-6)}
          </span>
          <span className={clsx(
            "badge",
            asset.active ? "badge-green" : "badge-red"
          )}>
            {asset.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </Link>
  );
}
