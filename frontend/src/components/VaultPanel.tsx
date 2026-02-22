"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Shield, TrendingUp, Zap, Loader2, CheckCircle, Info, Droplets, Layers, ArrowUpRight, BarChart2 } from "lucide-react";
import { clsx } from "clsx";
import { useVault } from "@/hooks/useVault";
import { YIELD_SOURCES } from "@/lib/contracts";

// ─── Simulated vault allocation ─────────────────────────────────────────

interface VaultAlloc {
  protocol: string;
  pool:     string;
  pct:      number;   // allocation %
  apy:      number;
  earned:   number;
  color:    string;
}

const BASE_ALLOCS: VaultAlloc[] = [
  { protocol: "Morpho",  pool: "USDC Lending",   pct: 38, apy: 18.4, earned: 0, color: "#60a5fa" },
  { protocol: "Kuru",    pool: "MON/USDC LP",    pct: 28, apy: 32.7, earned: 0, color: "#fbbf24" },
  { protocol: "Ambient", pool: "USDC Stable LP", pct: 18, apy: 14.1, earned: 0, color: "#34d399" },
  { protocol: "Kuru",    pool: "MON/WMON LP",    pct: 16, apy: 22.5, earned: 0, color: "#a78bfa" },
];

// ─── Risk profile card ─────────────────────────────────────────────────────

const RISK_OPTIONS = [
  {
    id:    0,
    icon:  Shield,
    label: "Conservative",
    desc:  "Stablecoins only · Audited protocols · No LP exposure",
    tags:  ["Morpho", "Ambient"],
    apy:   "12–18%",
    color: "text-green-400",
  },
  {
    id:    1,
    icon:  TrendingUp,
    label: "Balanced",
    desc:  "Stablecoins + blue-chip LP · Max 20% per protocol",
    tags:  ["Morpho", "Kuru", "Ambient"],
    apy:   "18–28%",
    color: "text-yellow-400",
  },
  {
    id:    2,
    icon:  Zap,
    label: "Aggressive",
    desc:  "Any yield source · Newer protocols · Higher APY",
    tags:  ["All protocols"],
    apy:   "28–45%",
    color: "text-red-400",
  },
];

function RiskCard({
  option,
  selected,
  onSelect,
}: {
  option: (typeof RISK_OPTIONS)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "text-left p-4 rounded-xl border transition-all duration-150 w-full",
        selected
          ? "border-white bg-white/5"
          : "border-[#1f1f1f] bg-[#111] hover:border-[#333]"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <option.icon size={14} className={option.color} />
          <span className="font-medium text-sm">{option.label}</span>
        </div>
        <span className={clsx("font-mono text-xs", option.color)}>{option.apy}</span>
      </div>
      <p className="text-[#555] text-xs leading-relaxed">{option.desc}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {option.tags.map((t) => (
          <span key={t} className="badge-gray text-[10px]">{t}</span>
        ))}
      </div>
    </button>
  );
}

// ─── Main VaultPanel ───────────────────────────────────────────────────────

export default function VaultPanel() {
  const { address, isConnected } = useAccount();
  const { portfolio, methBalance, deposit, withdraw, setRisk, claimFaucet, isDepositing, isWithdrawing, isSettingRisk, isFauceting } =
    useVault(address);

  const [depositAmount,  setDepositAmount]  = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [riskProfile,    setRiskProfile]    = useState<0|1|2>(1);
  const [activeForm,     setActiveForm]     = useState<"deposit"|"withdraw">("deposit");
  const [txSuccess,      setTxSuccess]      = useState<string | null>(null);

  // ── Simulated vault allocations (tick every 3s) ────────────────────
  const [allocs, setAllocs] = useState<VaultAlloc[]>(BASE_ALLOCS);

  useEffect(() => {
    const interval = setInterval(() => {
      setAllocs((prev) =>
        prev.map((a) => ({
          ...a,
          earned: a.earned + (a.pct * (a.apy / 100)) / (365 * 24 * 1200), // ~3s yield tick
          apy:    Math.max(5, a.apy + (Math.random() - 0.48) * 0.2),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const blendedApy = allocs.reduce((s, a) => s + a.apy * (a.pct / 100), 0);
  const totalEarned = allocs.reduce((s, a) => s + a.earned, 0);

  const handleDeposit = async () => {
    if (!depositAmount) return;
    try {
      await deposit(depositAmount);
      setTxSuccess("Deposit successful!");
      setDepositAmount("");
      setTimeout(() => setTxSuccess(null), 4000);
    } catch {}
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    try {
      await withdraw(withdrawAmount);
      setTxSuccess("Withdrawal successful!");
      setWithdrawAmount("");
      setTimeout(() => setTxSuccess(null), 4000);
    } catch {}
  };

  const handleFaucet = async () => {
    try {
      await claimFaucet();
      setTxSuccess("100 mETH claimed from faucet!");
      setTimeout(() => setTxSuccess(null), 4000);
    } catch {}
  };

  const handleSetRisk = async (level: 0|1|2) => {
    setRiskProfile(level);
    try {
      await setRisk(level);
    } catch {}
  };

  // mETH = 18 decimals — portfolio is a tuple: [balance, riskProfile, totalDeposited, totalWithdrawn, totalYieldEarned, isActive]
  const balance        = portfolio   ? (Number((portfolio as readonly [bigint, number, bigint, bigint, bigint, boolean])[0]) / 1e18).toFixed(4)           : "0.0000";
  const yieldEarned    = portfolio   ? (Number((portfolio as readonly [bigint, number, bigint, bigint, bigint, boolean])[4]) / 1e18).toFixed(6)  : "0.000000";
  const walletBalance  = methBalance ? (Number(methBalance) / 1e18).toFixed(4)                 : "0.0000";

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-[#111] border border-[#1f1f1f] rounded-2xl flex items-center justify-center mx-auto">
            <Shield size={20} className="text-[#444]" />
          </div>
          <p className="text-[#555] text-sm">Connect your wallet to manage your vault</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Vault</h2>
        <p className="text-xs text-[#555] font-mono mt-0.5">
          Autonomous yield optimization · Monad Testnet
        </p>
      </div>

      {/* ── Get mETH faucet ──────────────────────────────────────────── */}
      <div className="card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Droplets size={16} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">Get mETH</p>
            <p className="text-xs text-[#555] font-mono">Claim 100 mETH · Once per 24 hours</p>
          </div>
        </div>
        <button
          onClick={handleFaucet}
          disabled={isFauceting}
          className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 shrink-0"
        >
          {isFauceting ? (
            <><Loader2 size={12} className="animate-spin" /> Claiming…</>
          ) : (
            "Claim 100 mETH"
          )}
        </button>
      </div>

      {/* ── Balance summary ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="label-mono mb-2">WALLET</p>
          <p className="text-xl font-semibold text-blue-400">{walletBalance} <span className="text-sm font-normal text-blue-700">mETH</span></p>
          <p className="text-xs text-[#555] mt-1 font-mono">In your wallet</p>
        </div>
        <div className="card">
          <p className="label-mono mb-2">VAULT STAKED</p>
          <p className="text-xl font-semibold">{balance} <span className="text-sm font-normal text-[#555]">mETH</span></p>
          <p className="text-xs text-[#555] mt-1 font-mono">Deposited &amp; earning</p>
        </div>
        <div className="card">
          <p className="label-mono mb-2">YIELD EARNED</p>
          <p className="text-xl font-semibold text-green-400">{yieldEarned} <span className="text-sm font-normal text-green-700">mETH</span></p>
          <p className="text-xs text-[#555] mt-1 font-mono">Total harvested</p>
        </div>
        <div className="card">
          <p className="label-mono mb-2">RISK LEVEL</p>
          <p className={clsx(
            "text-xl font-semibold",
            riskProfile === 0 && "text-green-400",
            riskProfile === 1 && "text-yellow-400",
            riskProfile === 2 && "text-red-400",
          )}>
            {RISK_OPTIONS[riskProfile].label}
          </p>
          <p className="text-xs text-[#555] mt-1 font-mono">
            {RISK_OPTIONS[riskProfile].apy} APY range
          </p>
        </div>
      </div>

      {/* ── Success notification ─────────────────────────────────────── */}
      {txSuccess && (
        <div className="card flex items-center gap-3 text-green-400 text-sm animate-fade-in">
          <CheckCircle size={16} />
          <p>{txSuccess}</p>
        </div>
      )}

      {/* ── Deposit / Withdraw forms ─────────────────────────────────── */}
      <div className="card space-y-4">
        {/* Toggle */}
        <div className="flex gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-[#1f1f1f]">
          {(["deposit", "withdraw"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveForm(f)}
              className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all",
                activeForm === f
                  ? "bg-white text-black"
                  : "text-[#555] hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {activeForm === "deposit" ? (
          <>
            <div className="space-y-2">
              <label className="label-mono">AMOUNT (mETH)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => setDepositAmount(walletBalance)}
                  className="btn-secondary text-xs px-3"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-[#444] bg-[#0a0a0a] rounded-lg p-3">
              <Info size={12} className="shrink-0 mt-0.5" />
              <p>
                Depositing will approve the Vault contract to spend your mETH.
                The agent will autonomously rebalance based on your risk profile.
              </p>
            </div>
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !depositAmount}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isDepositing ? (
                <><Loader2 size={14} className="animate-spin" /> Depositing…</>
              ) : (
                `Deposit ${depositAmount || "0"} mETH`
              )}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="label-mono">AMOUNT (mETH)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={() => setWithdrawAmount(balance)}
                  className="btn-secondary text-xs px-3"
                >
                  ALL
                </button>
              </div>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isWithdrawing ? (
                <><Loader2 size={14} className="animate-spin" /> Withdrawing…</>
              ) : (
                `Withdraw ${withdrawAmount || "0"} mETH`
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Risk profile ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono">RISK PROFILE</p>
          {isSettingRisk && (
            <div className="flex items-center gap-1 text-xs text-[#555]">
              <Loader2 size={10} className="animate-spin" />
              <span>Updating…</span>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {RISK_OPTIONS.map((opt) => (
            <RiskCard
              key={opt.id}
              option={opt}
              selected={riskProfile === opt.id}
              onSelect={() => handleSetRisk(opt.id as 0|1|2)}
            />
          ))}
        </div>
      </div>

      {/* ── Live yield sources ───────────────────────────────────────── */}
      <div className="card space-y-3">        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-[#555]" />
            <p className="label-mono">YOUR VAULT ALLOCATION</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-[#555] font-mono">LIVE</span>
          </div>
        </div>

        {/* Allocation bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {allocs.map((a, i) => (
            <div
              key={i}
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${a.pct}%`, background: a.color }}
            />
          ))}
        </div>

        {/* Protocol rows */}
        <div className="space-y-1 mt-2">
          {allocs.map((a, i) => {
            const depositVal = parseFloat(balance) * (a.pct / 100);
            return (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  <div>
                    <p className="text-sm font-medium">{a.protocol}</p>
                    <p className="text-[10px] text-[#555] font-mono">{a.pool} · {a.pct}% allocated</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-green-400">{a.apy.toFixed(1)}%</p>
                  <p className="text-[10px] text-[#555] font-mono">
                    +{a.earned.toFixed(4)} mETH earned
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1f1f1f] text-xs">
          <div className="flex items-center gap-2">
            <BarChart2 size={12} className="text-[#555]" />
            <span className="text-[#888] font-mono">Blended APY</span>
          </div>
          <span className="font-mono font-semibold text-green-400">{blendedApy.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#888] font-mono">Total yield earned</span>
          <span className="font-mono font-semibold text-green-400">+{totalEarned.toFixed(4)} mETH</span>
        </div>
      </div>

      {/* ── Available yield sources ─────────────────────────────── */}
      <div className="card space-y-3">        <p className="label-mono">AVAILABLE YIELD SOURCES</p>
        <div className="space-y-2">
          {YIELD_SOURCES.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-2.5 border-b border-[#111] last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-[#555] font-mono">{s.protocol} · {s.risk} risk · {s.tvl} TVL</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold text-green-400">{s.apy}%</p>
                <p className="text-[10px] text-[#444] font-mono">APY</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agent status ─────────────────────────────────────────────── */}
      <div className="card flex items-center gap-4 text-sm">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Agent Active</p>
          <p className="text-xs text-[#555] font-mono">Polling every ~10 blocks · Rebalance threshold: 0.5% APY delta</p>
        </div>
        <span className="badge-green text-[10px]">LIVE</span>
      </div>
    </div>
  );
}
