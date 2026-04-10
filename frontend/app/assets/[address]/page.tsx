"use client";

import { useParams }                  from "next/navigation";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState }                   from "react";
import { parseEther, parseUnits }     from "viem";
import { ExternalLink, Loader, TrendingUp, Shield, BarChart3, DollarSign } from "lucide-react";
import clsx                           from "clsx";
import {
  CONTRACTS, RWA20_ABI, ORACLE_ABI, DISTRIBUTOR_ABI, BONDING_CURVE_ABI, ERC20_ABI,
  LAUNCHPAD_ABI, ASSET_TYPES, formatUSDC, formatToken, shortenAddress,
} from "../../../lib/contracts";

// ─────────────────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const params    = useParams();
  const token     = params.address as `0x${string}`;
  const { address: user } = useAccount();
  const [buyAmount, setBuyAmount] = useState("100");

  // ── Look up asset in launchpad by token address ────────────────────────────
  const { data: assetCount } = useReadContracts({
    contracts: [{ address: CONTRACTS.LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "assetCount" }],
  });

  // For MVP: use factory.tokenToOracle / tokenToDistributor
  // We'll read the token's .oracle() and .complianceModule() directly
  const { data: tokenData } = useReadContracts({
    contracts: [
      { address: token, abi: RWA20_ABI, functionName: "name"            },
      { address: token, abi: RWA20_ABI, functionName: "symbol"          },
      { address: token, abi: RWA20_ABI, functionName: "totalSupply"     },
      { address: token, abi: RWA20_ABI, functionName: "assetType"       },
      { address: token, abi: RWA20_ABI, functionName: "assetId"         },
      { address: token, abi: RWA20_ABI, functionName: "oracle"          },
      { address: token, abi: RWA20_ABI, functionName: "legalInfo"       },
      { address: token, abi: RWA20_ABI, functionName: "complianceModule"},
      ...(user ? [{ address: token, abi: RWA20_ABI, functionName: "balanceOf", args: [user] } as const] : []),
    ],
    query: { enabled: !!token },
  });

  const name        = tokenData?.[0]?.result as string   | undefined;
  const symbol      = tokenData?.[1]?.result as string   | undefined;
  const totalSupply = tokenData?.[2]?.result as bigint   | undefined;
  const assetType   = tokenData?.[3]?.result as number   | undefined;
  const assetId     = tokenData?.[4]?.result as string   | undefined;
  const oracleAddr  = tokenData?.[5]?.result as `0x${string}` | undefined;
  const legalInfo   = tokenData?.[6]?.result as any      | undefined;
  const userBalance = tokenData?.[8]?.result as bigint   | undefined;

  // ── Oracle data ────────────────────────────────────────────────────────────
  const { data: oracleData } = useReadContracts({
    contracts: oracleAddr ? [
      { address: oracleAddr, abi: ORACLE_ABI, functionName: "data" },
    ] : [],
    query: { enabled: !!oracleAddr },
  });
  const oracle = oracleData?.[0]?.result as any;

  // ── Launchpad asset lookup (for distributor + bonding curve) ───────────────
  const { data: launchpadAssets } = useReadContracts({
    contracts: [{ address: CONTRACTS.LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "getAllAssets" }],
  });
  const allAssets   = (launchpadAssets?.[0]?.result as any[]) ?? [];
  const launchAsset = allAssets.find((a: any) => a.token?.toLowerCase() === token.toLowerCase());

  // ── Distributor data ───────────────────────────────────────────────────────
  const distAddr = launchAsset?.distributor as `0x${string}` | undefined;
  const { data: distData } = useReadContracts({
    contracts: distAddr && user ? [
      { address: distAddr, abi: DISTRIBUTOR_ABI, functionName: "previewClaimable", args: [user] },
      { address: distAddr, abi: DISTRIBUTOR_ABI, functionName: "periodCount" },
    ] : [],
    query: { enabled: !!(distAddr && user) },
  });
  const claimable        = (distData?.[0]?.result as [bigint, bigint[]] | undefined);
  const claimableAmount  = claimable?.[0] ?? 0n;
  const claimablePeriods = claimable?.[1] ?? [];
  const periodCount      = distData?.[1]?.result as bigint | undefined;

  // ── Bonding curve data ─────────────────────────────────────────────────────
  const curveAddr = launchAsset?.bondingCurve as `0x${string}` | undefined;
  const hasCurve  = curveAddr && curveAddr !== "0x0000000000000000000000000000000000000000";

  const { data: curveData } = useReadContracts({
    contracts: hasCurve ? [
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "currentPrice" },
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "tokensSold"  },
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "fundingTarget"},
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "fundsRaised" },
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "progressBps" },
      { address: curveAddr!, abi: BONDING_CURVE_ABI, functionName: "quoteBuy", args: [parseEther(buyAmount || "1")] },
    ] : [],
    query: { enabled: !!hasCurve },
  });
  const currentPrice = curveData?.[0]?.result as bigint | undefined;
  const tokensSold   = curveData?.[1]?.result as bigint | undefined;
  const fundTarget   = curveData?.[2]?.result as bigint | undefined;
  const fundsRaised  = curveData?.[3]?.result as bigint | undefined;
  const progressBps  = curveData?.[4]?.result as bigint | undefined;
  const quoteBuy     = curveData?.[5]?.result as bigint | undefined;

  // ── Actions ────────────────────────────────────────────────────────────────
  const { writeContract: approveCurve, data: approveTx } = useWriteContract();
  const { writeContract: buyTokens,   data: buyTx }      = useWriteContract();
  const { writeContract: claimRewards, data: claimTx }   = useWriteContract();
  const { isLoading: isBuying }  = useWaitForTransactionReceipt({ hash: buyTx });
  const { isLoading: isClaiming } = useWaitForTransactionReceipt({ hash: claimTx });

  const handleBuy = async () => {
    if (!curveAddr || !quoteBuy) return;
    approveCurve({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "approve", args: [curveAddr, quoteBuy + parseUnits("1", 6)] });
    setTimeout(() => {
      buyTokens({ address: curveAddr, abi: BONDING_CURVE_ABI, functionName: "buy", args: [parseEther(buyAmount)] });
    }, 2000);
  };

  const handleClaim = () => {
    if (!distAddr || claimablePeriods.length === 0) return;
    claimRewards({
      address:      distAddr,
      abi:          DISTRIBUTOR_ABI,
      functionName: "claimMultiple",
      args:         [claimablePeriods],
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const typeIdx     = typeof assetType === "number" ? assetType : 0;
  const typeName    = ASSET_TYPES[typeIdx] ?? "Unknown";
  const typeIcons   = ["🏢","🌳","🥇","📜"];
  const progressPct = progressBps ? Math.min(100, Number(progressBps) / 100) : 0;

  // ─────────────────────────────────────────────────────────────────────────────

  if (!name) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-dark-muted">
        <Loader size={20} className="animate-spin" />
        Loading asset…
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{typeIcons[typeIdx]}</span>
          <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-brand-400 text-lg">{symbol}</span>
              <span className="badge badge-green">{typeName}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={`https://sepolia.etherscan.io/token/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
          >
            Etherscan <ExternalLink size={14} />
          </a>
          {launchAsset?.wrapper && (
            <a
              href={`https://app.uniswap.org/swap?outputCurrency=${launchAsset.wrapper}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
            >
              Trade wToken <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <TrendingUp size={18} className="text-brand-400" />
          <div className="stat-label">NAV</div>
          <div className="stat-value text-xl">
            {oracle ? formatUSDC(oracle.navUSD, 18) : "—"}
          </div>
        </div>
        <div className="stat-card">
          <DollarSign size={18} className="text-brand-400" />
          <div className="stat-label">Annual Yield</div>
          <div className="stat-value text-xl text-brand-400">
            {oracle ? `${(Number(oracle.annualYieldBps) / 100).toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <BarChart3 size={18} className="text-brand-400" />
          <div className="stat-label">Total Supply</div>
          <div className="stat-value text-xl">
            {totalSupply ? Number(totalSupply / BigInt(10 ** 18)).toLocaleString() : "—"}
          </div>
        </div>
        <div className="stat-card">
          <Shield size={18} className="text-brand-400" />
          <div className="stat-label">Revenue Periods</div>
          <div className="stat-value text-xl">
            {periodCount?.toString() ?? "0"}
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Left: Asset info */}
        <div className="space-y-4">

          {/* Oracle / Yield data */}
          {oracle && (
            <div className="card">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-400" />
                Oracle Data
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  ["NAV",         formatUSDC(oracle.navUSD, 18)],
                  ["Yield",       `${(Number(oracle.annualYieldBps) / 100).toFixed(2)}% per year`],
                  ["Period",      oracle.yieldPeriodStart > 0
                    ? `${new Date(Number(oracle.yieldPeriodStart) * 1000).toLocaleDateString()} → ${new Date(Number(oracle.yieldPeriodEnd) * 1000).toLocaleDateString()}`
                    : "—"],
                  ["Last Update", oracle.updatedAt > 0 ? new Date(Number(oracle.updatedAt) * 1000).toLocaleString() : "Never"],
                  ["Metadata",    oracle.yieldMetadata || "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-4">
                    <span className="text-dark-muted flex-shrink-0">{k}</span>
                    <span className="font-medium text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal info */}
          {legalInfo && (
            <div className="card">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-brand-400" />
                Legal Information
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Asset ID",     assetId],
                  ["SPV Name",     legalInfo.spvName],
                  ["Jurisdiction", legalInfo.jurisdiction],
                  ["Token",        shortenAddress(token)],
                  ["Oracle",       oracleAddr ? shortenAddress(oracleAddr) : "—"],
                  ["Distributor",  launchAsset?.distributor ? shortenAddress(launchAsset.distributor) : "—"],
                  ["Wrapper",      launchAsset?.wrapper ? shortenAddress(launchAsset.wrapper) : "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-4">
                    <span className="text-dark-muted flex-shrink-0">{k}</span>
                    <span className="font-mono text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">

          {/* My position */}
          {user && (
            <div className="card">
              <h3 className="font-bold mb-4">My Position</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-muted">Balance</span>
                  <span className="font-semibold">
                    {formatToken(userBalance ?? 0n)} {symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Claimable Revenue</span>
                  <span className={clsx("font-semibold", claimableAmount > 0n && "text-brand-400")}>
                    {formatUSDC(claimableAmount)}
                  </span>
                </div>
                {claimableAmount > 0n && (
                  <button
                    className="btn-primary w-full mt-2"
                    onClick={handleClaim}
                    disabled={isClaiming}
                  >
                    {isClaiming
                      ? <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" />Claiming…</span>
                      : `Claim ${formatUSDC(claimableAmount)}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bonding curve */}
          {hasCurve && (
            <div className="card">
              <h3 className="font-bold mb-4">Funding Round</h3>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-dark-muted">Progress</span>
                  <span className="font-medium">{progressPct.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-dark-muted mt-2">
                  <span>{fundsRaised ? formatUSDC(fundsRaised) : "$0"} raised</span>
                  <span>{fundTarget ? formatUSDC(fundTarget) : "—"} target</span>
                </div>
              </div>

              <div className="flex justify-between text-sm mb-4">
                <span className="text-dark-muted">Current Price</span>
                <span className="font-semibold">
                  {currentPrice ? `$${(Number(currentPrice) / 1e18).toFixed(4)}` : "—"} / token
                </span>
              </div>

              {/* Buy */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-dark-muted mb-2">Amount to buy (tokens)</label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={e => setBuyAmount(e.target.value)}
                    className="w-full"
                    min="1"
                  />
                  {quoteBuy !== undefined && (
                    <div className="text-xs text-dark-muted mt-1">
                      Cost: <span className="text-white font-medium">{formatUSDC(quoteBuy)}</span>
                    </div>
                  )}
                </div>
                <button
                  className="btn-primary w-full"
                  onClick={handleBuy}
                  disabled={isBuying || !user}
                >
                  {isBuying
                    ? <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" />Buying…</span>
                    : `Buy ${Number(buyAmount).toLocaleString()} ${symbol}`}
                </button>
                {!user && (
                  <p className="text-dark-muted text-xs text-center">Connect wallet to buy</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
