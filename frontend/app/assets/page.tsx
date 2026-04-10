"use client";

import { useState }             from "react";
import { useReadContract }      from "wagmi";
import { useReadContracts }     from "wagmi";
import { Search, Filter }       from "lucide-react";
import clsx                     from "clsx";
import { CONTRACTS, LAUNCHPAD_ABI, RWA20_ABI, ORACLE_ABI, ASSET_TYPES } from "../../lib/contracts";
import AssetCard                from "../../components/AssetCard";

// ── Types ─────────────────────────────────────────────────────────────────────

const FILTER_TYPES = ["All", ...ASSET_TYPES];

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Load all assets from launchpad
  const { data: rawAssets, isLoading } = useReadContract({
    address:      CONTRACTS.LAUNCHPAD,
    abi:          LAUNCHPAD_ABI,
    functionName: "getAllAssets",
  });

  const assets = (rawAssets as any[]) ?? [];

  // Filter
  const filtered = assets.filter((a: any) => {
    const typeMatch = filter === "All" || ASSET_TYPES[a.assetType] === filter;
    const searchLower = search.toLowerCase();
    const textMatch = !search
      || a.assetId?.toLowerCase().includes(searchLower)
      || a.token?.toLowerCase().includes(searchLower);
    return typeMatch && textMatch && a.active;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Asset Explorer</h1>
        <p className="text-dark-muted">
          Browse all tokenized real-world assets launched on the RWA20 protocol
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            placeholder="Search by token address or asset ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>

        <div className="flex gap-2">
          {FILTER_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={clsx(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                filter === type
                  ? "bg-brand-600 text-white"
                  : "bg-dark-surface border border-dark-border text-dark-muted hover:text-white"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-sm text-dark-muted">
        <span>{assets.length} total assets</span>
        <span>·</span>
        <span>{assets.filter((a: any) => a.active).length} active</span>
        {filter !== "All" && <><span>·</span><span>{filtered.length} matching</span></>}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse h-56">
              <div className="h-4 bg-dark-border rounded w-3/4 mb-3" />
              <div className="h-3 bg-dark-border rounded w-1/2 mb-6" />
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map(j => <div key={j} className="h-8 bg-dark-border rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🏗️</div>
          <h3 className="text-xl font-semibold mb-2">No assets found</h3>
          <p className="text-dark-muted mb-6">
            {assets.length === 0
              ? "No assets have been launched yet. Be the first!"
              : "Try adjusting your search or filter."}
          </p>
          <a href="/launch" className="btn-primary">Launch an Asset</a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((asset: any, i: number) => (
            <EnrichedAssetCard key={i} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Enriched card (fetches oracle data) ───────────────────────────────────────

function EnrichedAssetCard({ asset }: { asset: any }) {
  const { data } = useReadContracts({
    contracts: [
      { address: asset.token,  abi: RWA20_ABI,  functionName: "name"        },
      { address: asset.token,  abi: RWA20_ABI,  functionName: "symbol"      },
      { address: asset.token,  abi: RWA20_ABI,  functionName: "totalSupply" },
      { address: asset.oracle, abi: ORACLE_ABI, functionName: "getNAV"      },
      { address: asset.oracle, abi: ORACLE_ABI, functionName: "getYieldBps" },
    ],
  });

  const enriched = {
    ...asset,
    name:        data?.[0]?.result as string   | undefined,
    symbol:      data?.[1]?.result as string   | undefined,
    totalSupply: data?.[2]?.result as bigint   | undefined,
    navUSD:      data?.[3]?.result as bigint   | undefined,
    yieldBps:    data?.[4]?.result as bigint   | undefined,
  };

  return <AssetCard asset={enriched} />;
}
