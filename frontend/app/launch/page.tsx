"use client";

import { useState }             from "react";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, parseUnits, keccak256, toHex, zeroHash } from "viem";
import { Info, CheckCircle, AlertCircle, Loader }  from "lucide-react";
import clsx                     from "clsx";
import { CONTRACTS, LAUNCHPAD_ABI, ERC20_ABI, formatUSDC } from "../../lib/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { id: 0, name: "Real Estate",  icon: "🏢", desc: "Commercial / residential property via SPV" },
  { id: 1, name: "Agriculture",  icon: "🌳", desc: "Farm, orchard, or crop yield tokenization" },
  { id: 2, name: "Gold",         icon: "🥇", desc: "Precious metal backed token" },
  { id: 3, name: "Debt",         icon: "📜", desc: "Bond, invoice, or structured credit" },
];

interface FormState {
  name:          string;
  symbol:        string;
  assetType:     number;
  assetId:       string;
  spvName:       string;
  jurisdiction:  string;
  agreementHash: string;
  useCompliance: boolean;
  initialSupply: string;
  useBondingCurve: boolean;
  fundingTarget:   string;
  curveMaxTokens:  string;
  basePrice:       string;
}

const DEFAULT: FormState = {
  name:          "",
  symbol:        "",
  assetType:     0,
  assetId:       "",
  spvName:       "",
  jurisdiction:  "MY",
  agreementHash: "",
  useCompliance: true,
  initialSupply: "1000000",
  useBondingCurve: false,
  fundingTarget:   "100000",
  curveMaxTokens:  "500000",
  basePrice:       "1",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const { address, isConnected } = useAccount();
  const [form,   setForm]   = useState<FormState>(DEFAULT);
  const [step,   setStep]   = useState<1 | 2 | 3>(1);

  // Read USDC balance + launch fee
  const { data: usdcBalance } = useReadContract({
    address:      CONTRACTS.USDC,
    abi:          ERC20_ABI,
    functionName: "balanceOf",
    args:         [address!],
    query:        { enabled: !!address },
  });

  const { data: launchFee } = useReadContract({
    address:      CONTRACTS.LAUNCHPAD,
    abi:          LAUNCHPAD_ABI,
    functionName: "launchFee",
  });

  const { data: allowance } = useReadContract({
    address:      CONTRACTS.USDC,
    abi:          ERC20_ABI,
    functionName: "allowance",
    args:         [address!, CONTRACTS.LAUNCHPAD],
    query:        { enabled: !!address },
  });

  // Approve USDC
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { isLoading: approveLoading } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // Launch
  const { writeContract: launch, data: launchTxHash, isPending: isLaunching } = useWriteContract();
  const { isLoading: launchLoading, isSuccess: launchSuccess, data: launchReceipt } = useWaitForTransactionReceipt({ hash: launchTxHash });

  // Faucet
  const { writeContract: faucet, isPending: isFauceting } = useWriteContract();

  const fee = launchFee ?? 0n;
  const needsApproval = (allowance ?? 0n) < fee;

  function update(field: keyof FormState, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleApprove() {
    approve({
      address:      CONTRACTS.USDC,
      abi:          ERC20_ABI,
      functionName: "approve",
      args:         [CONTRACTS.LAUNCHPAD, parseUnits("1000", 6)],
    });
  }

  async function handleLaunch() {
    const agreementHash = form.agreementHash
      ? (keccak256(toHex(form.agreementHash)) as `0x${string}`)
      : zeroHash;

    launch({
      address:      CONTRACTS.LAUNCHPAD,
      abi:          LAUNCHPAD_ABI,
      functionName: "launch",
      args: [{
        name:          form.name,
        symbol:        form.symbol.toUpperCase(),
        assetType:     form.assetType,
        assetId:       form.assetId,
        legalInfo: {
          spvName:       form.spvName,
          jurisdiction:  form.jurisdiction,
          agreementHash,
        },
        useCompliance:    form.useCompliance,
        initialSupply:    form.useBondingCurve ? 0n : parseEther(form.initialSupply || "0"),
        fundingTarget:    form.useBondingCurve ? parseUnits(form.fundingTarget, 6) : 0n,
        curveMaxTokens:   form.useBondingCurve ? parseEther(form.curveMaxTokens)  : 0n,
        bondingBasePrice: form.useBondingCurve ? parseEther(form.basePrice)       : 0n,
        bondingSlope:     form.useBondingCurve ? parseEther("0.000001")           : 0n,
      }],
    });
    setStep(3);
  }

  // ── Step indicator ──────────────────────────────────────────────────────────

  const steps = ["Asset Details", "Token Config", "Launch"];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">🚀 Launch RWA Token</h1>
        <p className="text-dark-muted">
          Deploy a complete RWA20 token ecosystem in one transaction.
          Inspired by pump.fun — but for real-world assets.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => n < step && setStep(n)}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors",
                  step === n   ? "bg-brand-500 text-white"             :
                  step > n     ? "bg-brand-900 text-brand-400 cursor-pointer" :
                                 "bg-dark-border text-dark-muted"
                )}
              >
                {step > n ? "✓" : n}
              </button>
              <span className={clsx("text-sm hidden sm:block", step >= n ? "text-white" : "text-dark-muted")}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className={clsx("flex-1 h-0.5 mx-2", step > n ? "bg-brand-500" : "bg-dark-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Connect wallet prompt */}
      {!isConnected && (
        <div className="card border-yellow-700/50 bg-yellow-900/10 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-200">Connect your wallet to launch a token.</span>
        </div>
      )}

      {/* ── Step 1: Asset Details ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card space-y-6">
          <h2 className="font-bold text-lg">Asset Details</h2>

          {/* Asset type selector */}
          <div>
            <label className="block text-sm text-dark-muted mb-3">Asset Type</label>
            <div className="grid grid-cols-2 gap-3">
              {ASSET_TYPES.map(({ id, name, icon, desc }) => (
                <button
                  key={id}
                  onClick={() => update("assetType", id)}
                  className={clsx(
                    "text-left p-4 rounded-xl border transition-all",
                    form.assetType === id
                      ? "border-brand-500 bg-brand-900/30"
                      : "border-dark-border hover:border-brand-700"
                  )}
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="font-semibold text-sm">{name}</div>
                  <div className="text-dark-muted text-xs mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Asset ID */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Asset ID</label>
            <input
              placeholder="e.g. RE-MY-KL-TOWER-001"
              value={form.assetId}
              onChange={e => update("assetId", e.target.value)}
              className="w-full"
            />
            <p className="text-dark-muted text-xs mt-1">
              Unique off-chain identifier for this asset
            </p>
          </div>

          {/* Legal info */}
          <div className="space-y-3">
            <label className="block text-sm text-dark-muted font-medium">Legal Information</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-muted mb-1">SPV Name</label>
                <input
                  placeholder="My SPV Sdn Bhd"
                  value={form.spvName}
                  onChange={e => update("spvName", e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Jurisdiction</label>
                <select
                  value={form.jurisdiction}
                  onChange={e => update("jurisdiction", e.target.value)}
                  className="w-full"
                >
                  {["MY","SG","US","GB","AU","HK","JP","DE","AE"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-dark-muted mb-1">Agreement Reference (optional)</label>
              <input
                placeholder="IPFS CID or document identifier"
                value={form.agreementHash}
                onChange={e => update("agreementHash", e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <button
            className="btn-primary w-full"
            disabled={!form.assetId}
            onClick={() => setStep(2)}
          >
            Next: Token Config →
          </button>
        </div>
      )}

      {/* ── Step 2: Token Config ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card space-y-6">
          <h2 className="font-bold text-lg">Token Configuration</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-muted mb-2">Token Name</label>
              <input
                placeholder="KL Tower Office Token"
                value={form.name}
                onChange={e => update("name", e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-muted mb-2">Symbol</label>
              <input
                placeholder="KLTO"
                value={form.symbol}
                onChange={e => update("symbol", e.target.value.toUpperCase())}
                className="w-full font-mono"
                maxLength={8}
              />
            </div>
          </div>

          {/* Compliance */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-dark-border">
            <div>
              <div className="font-medium">KYC Compliance</div>
              <div className="text-dark-muted text-sm">
                {form.useCompliance
                  ? "Transfers require KYC approval (recommended for real estate)"
                  : "Open trading — no KYC required (recommended for agriculture)"}
              </div>
            </div>
            <button
              onClick={() => update("useCompliance", !form.useCompliance)}
              className={clsx(
                "w-12 h-6 rounded-full transition-colors flex-shrink-0",
                form.useCompliance ? "bg-brand-500" : "bg-dark-border"
              )}
            >
              <div className={clsx(
                "w-5 h-5 rounded-full bg-white m-0.5 transition-transform",
                form.useCompliance ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Bonding curve toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-dark-border">
            <div>
              <div className="font-medium">Bonding Curve Fundraising</div>
              <div className="text-dark-muted text-sm">
                {form.useBondingCurve
                  ? "Tokens sold via price curve — great for crowdfunding"
                  : "Mint initial supply directly to your wallet"}
              </div>
            </div>
            <button
              onClick={() => update("useBondingCurve", !form.useBondingCurve)}
              className={clsx(
                "w-12 h-6 rounded-full transition-colors flex-shrink-0",
                form.useBondingCurve ? "bg-brand-500" : "bg-dark-border"
              )}
            >
              <div className={clsx(
                "w-5 h-5 rounded-full bg-white m-0.5 transition-transform",
                form.useBondingCurve ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Conditional fields */}
          {!form.useBondingCurve && (
            <div>
              <label className="block text-sm text-dark-muted mb-2">Initial Supply (tokens)</label>
              <input
                type="number"
                placeholder="1000000"
                value={form.initialSupply}
                onChange={e => update("initialSupply", e.target.value)}
                className="w-full"
              />
              <p className="text-dark-muted text-xs mt-1">Tokens minted directly to your wallet</p>
            </div>
          )}

          {form.useBondingCurve && (
            <div className="space-y-4 p-4 rounded-xl bg-dark-bg border border-dark-border">
              <h3 className="font-medium text-sm">Bonding Curve Parameters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-dark-muted mb-1">Funding Target (USDC)</label>
                  <input
                    type="number"
                    value={form.fundingTarget}
                    onChange={e => update("fundingTarget", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-dark-muted mb-1">Max Tokens for Sale</label>
                  <input
                    type="number"
                    value={form.curveMaxTokens}
                    onChange={e => update("curveMaxTokens", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-dark-muted mb-1">Floor Price (USD per token)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.basePrice}
                    onChange={e => update("basePrice", e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fee info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-dark-bg border border-dark-border">
            <Info size={16} className="text-dark-muted mt-0.5 flex-shrink-0" />
            <div className="text-sm text-dark-muted">
              Launch fee: <span className="text-white font-medium">
                {launchFee ? formatUSDC(launchFee) : "loading…"}
              </span>.
              {usdcBalance !== undefined && (
                <span> Your balance: <span className="text-white">{formatUSDC(usdcBalance)}</span></span>
              )}
              <span className="block mt-1">Deploys: RWA20Token + Compliance + Oracle + RevenueDistributor + WRWA20</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep(1)}>← Back</button>
            <button
              className="btn-primary flex-2"
              disabled={!form.name || !form.symbol || !isConnected}
              onClick={() => setStep(3)}
            >
              Review & Launch →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm & Launch ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card space-y-6">
          <h2 className="font-bold text-lg">Review & Launch</h2>

          {/* Summary */}
          <div className="space-y-3">
            {[
              ["Asset Type",     ASSET_TYPES[form.assetType]?.name],
              ["Token Name",     form.name],
              ["Symbol",         form.symbol],
              ["Asset ID",       form.assetId],
              ["SPV",            form.spvName || "—"],
              ["Jurisdiction",   form.jurisdiction],
              ["Compliance",     form.useCompliance ? "KYC Required" : "Open Trading"],
              ["Distribution",   form.useBondingCurve ? `Bonding Curve ($${form.fundingTarget} target)` : `Direct mint (${Number(form.initialSupply).toLocaleString()} tokens)`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-dark-border/50 text-sm">
                <span className="text-dark-muted">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>

          {/* What gets deployed */}
          <div className="bg-dark-bg rounded-xl p-4 border border-dark-border">
            <div className="text-sm text-dark-muted mb-3 font-medium">What gets deployed:</div>
            <div className="space-y-2 text-sm">
              {[
                ["RWA20Token",          "ERC-20 + compliance + votes"],
                [form.useCompliance ? "BasicCompliance" : "NoCompliance", form.useCompliance ? "KYC whitelist" : "Open trading"],
                ["AssetOracle",         "NAV + yield data"],
                ["RevenueDistributor",  "USDC snapshot payouts"],
                ["WRWA20",              "DEX wrapper token"],
                ...(form.useBondingCurve ? [["BondingCurve", "Linear price curve"]] : []),
              ].map(([name, desc]) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                  <span className="font-mono text-xs text-brand-400">{name}</span>
                  <span className="text-dark-muted">— {desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Launch or approve */}
          {launchSuccess ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-900/30 border border-brand-700">
              <CheckCircle size={24} className="text-brand-400" />
              <div>
                <div className="font-semibold text-brand-300">Token Launched!</div>
                <div className="text-sm text-brand-500">
                  Tx: {launchTxHash?.slice(0, 14)}…
                </div>
                <a href="/assets" className="text-sm text-brand-400 hover:underline">
                  View in Assets Explorer →
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {needsApproval && (
                <button
                  className="btn-secondary w-full"
                  onClick={handleApprove}
                  disabled={isApproving || approveLoading || !isConnected}
                >
                  {(isApproving || approveLoading)
                    ? <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> Approving USDC…</span>
                    : `1. Approve ${formatUSDC(fee)} USDC`}
                </button>
              )}
              <button
                className="btn-primary w-full"
                onClick={handleLaunch}
                disabled={needsApproval || isLaunching || launchLoading || !isConnected}
              >
                {(isLaunching || launchLoading)
                  ? <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> Launching…</span>
                  : needsApproval ? "2. Launch Token" : "Launch Token 🚀"}
              </button>
            </div>
          )}

          {!launchSuccess && (
            <button className="btn-secondary w-full" onClick={() => setStep(2)}>← Edit Config</button>
          )}
        </div>
      )}
    </div>
  );
}
