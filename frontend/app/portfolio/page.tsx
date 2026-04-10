"use client";

import { useAccount, useReadContracts } from "wagmi";
import { useReadContract }              from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState }                     from "react";
import { Loader, AlertCircle }          from "lucide-react";
import clsx                             from "clsx";
import {
  CONTRACTS, LAUNCHPAD_ABI, RWA20_ABI, DISTRIBUTOR_ABI, ORACLE_ABI,
  ASSET_TYPES, formatUSDC, formatToken, shortenAddress,
} from "../../lib/contracts";

// ─────────────────────────────────────────────────────────────────────────────

interface HoldingRow {
  token:       string;
  name:        string;
  symbol:      string;
  balance:     bigint;
  navUSD:      bigint;
  yieldBps:    bigint;
  distributor: string;
  claimable:   bigint;
  periods:     bigint[];
  assetType:   number;
}

export default function PortfolioPage() {
  const { address: user, isConnected } = useAccount();

  // Load all assets from launchpad
  const { data: rawAssets } = useReadContract({
    address:      CONTRACTS.LAUNCHPAD,
    abi:          LAUNCHPAD_ABI,
    functionName: "getAllAssets",
  });

  const assets = (rawAssets as any[]) ?? [];

  if (!isConnected) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4">💼</div>
        <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
        <p className="text-dark-muted">Connect your wallet to view your RWA20 portfolio and claim revenue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
        <p className="text-dark-muted">
          Your RWA20 holdings and unclaimed revenue distributions
        </p>
      </div>

      {assets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-dark-muted">No assets launched yet.</p>
          <a href="/assets" className="btn-primary mt-4 inline-block">Browse Assets</a>
        </div>
      ) : (
        <HoldingsTable assets={assets} user={user!} />
      )}
    </div>
  );
}

// ── Holdings table ─────────────────────────────────────────────────────────────

function HoldingsTable({ assets, user }: { assets: any[]; user: string }) {
  // Batch-read balances, names, oracle, distributor preview for all assets
  const contracts = assets.flatMap((a: any) => [
    { address: a.token,  abi: RWA20_ABI,      functionName: "balanceOf",       args: [user] } as const,
    { address: a.token,  abi: RWA20_ABI,      functionName: "name"                         } as const,
    { address: a.token,  abi: RWA20_ABI,      functionName: "symbol"                       } as const,
    { address: a.oracle, abi: ORACLE_ABI,     functionName: "getNAV"                       } as const,
    { address: a.oracle, abi: ORACLE_ABI,     functionName: "getYieldBps"                  } as const,
    { address: a.distributor, abi: DISTRIBUTOR_ABI, functionName: "previewClaimable", args: [user] } as const,
  ]);

  const { data: results } = useReadContracts({ contracts });

  const COLS = 6;
  const holdings: HoldingRow[] = assets.map((a: any, i: number) => {
    const base = i * COLS;
    const claimPreview = results?.[base + 5]?.result as [bigint, bigint[]] | undefined;
    return {
      token:       a.token,
      assetType:   a.assetType,
      name:        (results?.[base + 1]?.result as string) ?? a.assetId,
      symbol:      (results?.[base + 2]?.result as string) ?? "—",
      balance:     (results?.[base + 0]?.result as bigint) ?? 0n,
      navUSD:      (results?.[base + 3]?.result as bigint) ?? 0n,
      yieldBps:    (results?.[base + 4]?.result as bigint) ?? 0n,
      distributor: a.distributor,
      claimable:   claimPreview?.[0] ?? 0n,
      periods:     claimPreview?.[1] ?? [],
    };
  }).filter(h => h.balance > 0n || h.claimable > 0n);

  const totalClaimable = holdings.reduce((s, h) => s + h.claimable, 0n);

  if (holdings.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">📭</div>
        <h3 className="text-lg font-semibold mb-2">No holdings yet</h3>
        <p className="text-dark-muted mb-6">Buy tokens from the asset explorer to start building your portfolio.</p>
        <a href="/assets" className="btn-primary inline-block">Explore Assets</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {totalClaimable > 0n && (
        <div className="card border-brand-700/50 bg-brand-900/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-dark-muted text-sm">Total Claimable Revenue</div>
              <div className="text-3xl font-bold text-brand-400">{formatUSDC(totalClaimable)}</div>
            </div>
            <ClaimAllButton holdings={holdings} />
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border text-dark-muted text-sm">
              <th className="text-left px-6 py-4">Asset</th>
              <th className="text-right px-4 py-4">Balance</th>
              <th className="text-right px-4 py-4">NAV</th>
              <th className="text-right px-4 py-4">Yield</th>
              <th className="text-right px-4 py-4">Claimable</th>
              <th className="text-right px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => (
              <HoldingRow key={h.token} holding={h} isLast={i === holdings.length - 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Holding row ────────────────────────────────────────────────────────────────

function HoldingRow({ holding: h, isLast }: { holding: HoldingRow; isLast: boolean }) {
  const { writeContract: claim, data: claimTx } = useWriteContract();
  const { isLoading: isClaiming } = useWaitForTransactionReceipt({ hash: claimTx });

  const typeIcons = ["🏢","🌳","🥇","📜"];
  const icon      = typeIcons[h.assetType] ?? "📦";

  return (
    <tr className={clsx("hover:bg-dark-bg/50 transition-colors", !isLast && "border-b border-dark-border")}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <a href={`/assets/${h.token}`} className="font-medium hover:text-brand-400 transition-colors">
              {h.name}
            </a>
            <div className="font-mono text-xs text-dark-muted">{h.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-right font-mono">
        {formatToken(h.balance)} <span className="text-dark-muted text-xs">{h.symbol}</span>
      </td>
      <td className="px-4 py-4 text-right">
        {h.navUSD > 0n ? formatUSDC(h.navUSD, 18) : "—"}
      </td>
      <td className="px-4 py-4 text-right">
        {h.yieldBps > 0n
          ? <span className="text-brand-400">{(Number(h.yieldBps) / 100).toFixed(2)}%</span>
          : "—"}
      </td>
      <td className="px-4 py-4 text-right font-semibold">
        {h.claimable > 0n
          ? <span className="text-brand-400">{formatUSDC(h.claimable)}</span>
          : <span className="text-dark-muted">—</span>}
      </td>
      <td className="px-6 py-4 text-right">
        {h.claimable > 0n ? (
          <button
            className="btn-primary text-sm py-2 px-4"
            onClick={() => claim({
              address:      h.distributor as `0x${string}`,
              abi:          DISTRIBUTOR_ABI,
              functionName: "claimMultiple",
              args:         [h.periods],
            })}
            disabled={isClaiming}
          >
            {isClaiming
              ? <Loader size={14} className="animate-spin mx-auto" />
              : "Claim"}
          </button>
        ) : (
          <span className="text-dark-muted text-sm">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Claim all button ───────────────────────────────────────────────────────────

function ClaimAllButton({ holdings }: { holdings: HoldingRow[] }) {
  const [loading, setLoading] = useState(false);
  const { writeContract: claim } = useWriteContract();

  const claimable = holdings.filter(h => h.claimable > 0n);

  const handleClaimAll = async () => {
    setLoading(true);
    for (const h of claimable) {
      if (h.periods.length > 0) {
        claim({
          address:      h.distributor as `0x${string}`,
          abi:          DISTRIBUTOR_ABI,
          functionName: "claimMultiple",
          args:         [h.periods],
        });
      }
    }
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <button
      className="btn-primary flex items-center gap-2"
      onClick={handleClaimAll}
      disabled={loading || claimable.length === 0}
    >
      {loading
        ? <><Loader size={16} className="animate-spin" /> Claiming…</>
        : `Claim All (${claimable.length} assets)`}
    </button>
  );
}
