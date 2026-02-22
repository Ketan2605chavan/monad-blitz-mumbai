"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock, Activity, ArrowUpRight, Layers, Zap } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { clsx } from "clsx";

// ─── Simulated protocol positions ────────────────────────────────────────

interface ProtocolPosition {
  protocol:  string;
  pool:      string;
  deposited: number;
  apy:       number;
  earned:    number;
  risk:      "low" | "medium" | "high";
  tvl:       string;
  change24h: number;
}

const BASE_POSITIONS: ProtocolPosition[] = [
  { protocol: "Morpho",  pool: "USDC Lending",    deposited: 2450.0, apy: 18.4, earned: 42.18, risk: "low",    tvl: "$2.1M",  change24h: 0.8  },
  { protocol: "Kuru",    pool: "MON/USDC LP",     deposited: 1820.0, apy: 32.7, earned: 89.54, risk: "medium", tvl: "$890K",  change24h: 2.3  },
  { protocol: "Ambient", pool: "USDC Stable LP",  deposited: 1180.0, apy: 14.1, earned: 18.62, risk: "low",    tvl: "$3.4M",  change24h: -0.4 },
  { protocol: "Kuru",    pool: "MON/WMON LP",     deposited: 950.0,  apy: 22.5, earned: 31.22, risk: "medium", tvl: "$1.2M",  change24h: 1.5  },
];

const SIMULATED_DECISIONS = [
  {
    action:    "REBALANCE",
    reasoning: "Kuru MON/USDC APY spiked to 34.2% — shifted 8% from Ambient stable pool. Risk stays balanced.",
    time:      Date.now() - 180_000,
    block:     "#4,892,107",
  },
  {
    action:    "YIELD HARVEST",
    reasoning: "Harvested 12.4 mETH from Morpho USDC lending. Auto-compounded into same position.",
    time:      Date.now() - 720_000,
    block:     "#4,891,450",
  },
  {
    action:    "RISK CHECK",
    reasoning: "Portfolio health check — all positions within balanced risk tolerance. No action needed. Blended APY: 21.8%.",
    time:      Date.now() - 1_800_000,
    block:     "#4,890,203",
  },
  {
    action:    "REBALANCE",
    reasoning: "Morpho rate decreased 1.2% → moved 5% allocation to Kuru MON/WMON for better risk-adjusted return.",
    time:      Date.now() - 3_600_000,
    block:     "#4,888,955",
  },
  {
    action:    "DEPOSIT",
    reasoning: "New deposit of 500 mETH received. Allocated: 38% Morpho, 28% Kuru MON/USDC, 18% Ambient, 16% Kuru MON/WMON.",
    time:      Date.now() - 7_200_000,
    block:     "#4,886,001",
  },
];

// ─── Mock yield history (replace with on-chain data) ─────────────────────

const YIELD_HISTORY = Array.from({ length: 14 }, (_, i) => {
  const base = 5800 + i * 65;
  return {
    day:   `Feb ${i + 8}`,
    value: base + Math.sin(i * 0.7) * 120 + Math.random() * 40,
    yield: 14 + Math.sin(i * 0.5) * 4 + Math.random() * 2,
  };
});

const PROTOCOL_COLORS: Record<string, string> = {
  Morpho:  "#60a5fa",
  Kuru:    "#fbbf24",
  Ambient: "#34d399",
  Cash:    "#555555",
};

const RISK_BG: Record<string, string> = {
  low:    "bg-green-400/10 text-green-400",
  medium: "bg-yellow-400/10 text-yellow-400",
  high:   "bg-red-400/10 text-red-400",
};

const RISK_LABELS: Record<number, string> = {
  0: "Conservative",
  1: "Balanced",
  2: "Aggressive",
};
const RISK_COLOR: Record<number, string> = {
  0: "text-green-400",
  1: "text-yellow-400",
  2: "text-red-400",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <Icon size={14} className="text-[#444]" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && (
        <p
          className={clsx(
            "text-xs font-mono flex items-center gap-1",
            positive === true  && "text-green-400",
            positive === false && "text-red-400",
            positive === undefined && "text-[#555]"
          )}
        >
          {positive === true  && <TrendingUp  size={11} />}
          {positive === false && <TrendingDown size={11} />}
          {sub}
        </p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-xs font-mono">
      <p className="text-[#888] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-white">
          ${p.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function PortfolioDashboard() {
  const { address, isConnected } = useAccount();
  const { portfolio, allocations, decisions, isLoading } = usePortfolio(address);

  // ── Simulated live positions (tick every 3s) ──────────────────────────
  const [positions, setPositions] = useState<ProtocolPosition[]>(BASE_POSITIONS);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setPositions((prev) =>
        prev.map((p) => ({
          ...p,
          earned:    p.earned + (p.deposited * (p.apy / 100)) / (365 * 24 * 1200), // ~3s yield step
          apy:       Math.max(5, p.apy + (Math.random() - 0.48) * 0.3),
          change24h: p.change24h + (Math.random() - 0.5) * 0.1,
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalDeposited = positions.reduce((s, p) => s + p.deposited, 0);
  const totalEarned    = positions.reduce((s, p) => s + p.earned, 0);
  const blendedApy     = positions.reduce((s, p) => s + p.apy * (p.deposited / totalDeposited), 0);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-[#111] border border-[#1f1f1f] rounded-2xl flex items-center justify-center mx-auto">
            <Activity size={20} className="text-[#444]" />
          </div>
          <p className="text-[#555] text-sm">Connect your wallet to view portfolio</p>
        </div>
      </div>
    );
  }

  const balance      = portfolio?.balance      ? Number(portfolio.balance) / 1e18 : 0;
  const yieldEarned  = portfolio?.totalYieldEarned ? Number(portfolio.totalYieldEarned) / 1e18 : 0;
  const riskProfile  = portfolio?.riskProfile != null ? Number(portfolio.riskProfile) : 1;

  // Merge on-chain + simulated
  const displayBalance = balance > 0 ? balance : totalDeposited;
  const displayYield   = yieldEarned > 0 ? yieldEarned : totalEarned;
  const displayApy     = blendedApy;

  // Build pie data from positions
  const pieData = positions.map((p) => ({
    name:  p.protocol,
    value: Math.round((p.deposited / totalDeposited) * 100),
  }));
  // Merge duplicate protocols
  const mergedPie = Object.values(
    pieData.reduce<Record<string, { name: string; value: number }>>((acc, d) => {
      acc[d.name] = acc[d.name] ? { ...acc[d.name], value: acc[d.name].value + d.value } : d;
      return acc;
    }, {})
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Portfolio</h2>
          <p className="text-xs font-mono text-[#555] mt-0.5">
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx("text-xs font-mono", RISK_COLOR[riskProfile])}>
            {RISK_LABELS[riskProfile]}
          </span>
          <span className="badge-gray">{isLoading ? "Loading…" : "Live"}</span>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={DollarSign}
          label="TOTAL BALANCE"
          value={`$${displayBalance.toFixed(2)}`}
          sub="Across all protocols"
        />
        <StatCard
          icon={TrendingUp}
          label="YIELD EARNED"
          value={`$${displayYield.toFixed(2)}`}
          sub={`+$${(totalEarned * 0.12).toFixed(2)} today`}
          positive
        />
        <StatCard
          icon={Percent}
          label="BLENDED APY"
          value={`${displayApy.toFixed(1)}%`}
          sub="Weighted average"
          positive
        />
        <StatCard
          icon={Clock}
          label="LAST REBALANCE"
          value="3 min ago"
          sub="Agent optimized"
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Yield area chart */}
        <div className="md:col-span-2 card">
          <p className="label-mono mb-4">YIELD PERFORMANCE (14D)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={YIELD_HISTORY} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "#444", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#60a5fa"
                strokeWidth={1.5}
                fill="url(#areaGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation pie */}
        <div className="card flex flex-col">
          <p className="label-mono mb-4">ALLOCATION</p>
          <div className="flex-1 flex items-center">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={mergedPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {mergedPie.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PROTOCOL_COLORS[entry.name] ?? "#666"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v}%`, ""]}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #333",
                    borderRadius: 12,
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#fff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {mergedPie.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: PROTOCOL_COLORS[d.name] ?? "#666" }}
                  />
                  <span className="text-[#888]">{d.name}</span>
                </div>
                <span className="font-mono text-white">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Protocol Positions (simulated) ───────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-[#555]" />
            <p className="label-mono">PROTOCOL POSITIONS</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-[#555] font-mono">LIVE</span>
          </div>
        </div>
        <div className="space-y-1">
          {/* Table header */}
          <div className="grid grid-cols-6 gap-2 text-[10px] text-[#444] font-mono px-3 py-2">
            <span className="col-span-2">PROTOCOL / POOL</span>
            <span className="text-right">DEPOSITED</span>
            <span className="text-right">EARNED</span>
            <span className="text-right">APY</span>
            <span className="text-right">24H</span>
          </div>
          {positions.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-6 gap-2 items-center px-3 py-3 rounded-xl hover:bg-white/[0.02] transition-colors"
            >
              <div className="col-span-2 flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PROTOCOL_COLORS[p.protocol] ?? "#666" }}
                />
                <div>
                  <p className="text-sm font-medium">{p.protocol}</p>
                  <p className="text-[10px] text-[#555] font-mono">{p.pool}</p>
                </div>
              </div>
              <p className="text-right font-mono text-sm">${p.deposited.toFixed(0)}</p>
              <p className="text-right font-mono text-sm text-green-400">
                +${p.earned.toFixed(2)}
              </p>
              <p className="text-right font-mono text-sm text-green-400">
                {p.apy.toFixed(1)}%
              </p>
              <div className="text-right">
                <span className={clsx(
                  "text-xs font-mono inline-flex items-center gap-0.5",
                  p.change24h >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {p.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(p.change24h).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
          {/* Total row */}
          <div className="grid grid-cols-6 gap-2 items-center px-3 py-3 border-t border-[#1f1f1f] mt-1">
            <div className="col-span-2">
              <p className="text-sm font-semibold">Total</p>
            </div>
            <p className="text-right font-mono text-sm font-semibold">${totalDeposited.toFixed(0)}</p>
            <p className="text-right font-mono text-sm font-semibold text-green-400">+${totalEarned.toFixed(2)}</p>
            <p className="text-right font-mono text-sm font-semibold text-green-400">{blendedApy.toFixed(1)}%</p>
            <div />
          </div>
        </div>
      </div>

      {/* ── Decision log ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="label-mono">AGENT DECISION LOG</p>
          <div className="flex items-center gap-1">
            <Zap size={10} className="text-yellow-400" />
            <span className="text-[10px] text-[#555] font-mono">GPT-4o-mini</span>
          </div>
        </div>
        {(() => {
          // Use on-chain decisions if available, else simulated
          const hasOnChain = decisions && decisions.length > 0;
          const displayDecisions = hasOnChain
            ? [...decisions].reverse().slice(0, 5).map((d: {
                action: string; reasoning: string; timestamp: bigint; blockNumber: bigint;
              }) => ({
                action:    d.action,
                reasoning: d.reasoning,
                time:      Number(d.timestamp) * 1000,
                block:     `#${d.blockNumber?.toString()}`,
              }))
            : SIMULATED_DECISIONS;

          return (
            <div className="space-y-3">
              {displayDecisions.map((d, i) => {
                const age = Date.now() - d.time;
                const timeAgo = age < 60_000
                  ? "just now"
                  : age < 3_600_000
                    ? `${Math.floor(age / 60_000)}m ago`
                    : `${Math.floor(age / 3_600_000)}h ago`;
                return (
                  <div key={i} className="flex gap-3 text-xs border-b border-[#111] pb-3 last:border-0 last:pb-0">
                    <div className={clsx(
                      "w-1 rounded-full shrink-0",
                      d.action === "REBALANCE" ? "bg-blue-400/50" :
                      d.action === "YIELD HARVEST" ? "bg-green-400/50" :
                      d.action === "DEPOSIT" ? "bg-white/30" :
                      "bg-yellow-400/30"
                    )} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold",
                          d.action === "REBALANCE" ? "bg-blue-400/10 text-blue-400" :
                          d.action === "YIELD HARVEST" ? "bg-green-400/10 text-green-400" :
                          d.action === "DEPOSIT" ? "bg-white/10 text-white" :
                          "bg-yellow-400/10 text-yellow-400"
                        )}>{d.action}</span>
                        <span className="text-[#444] font-mono">Block {d.block}</span>
                        <span className="text-[#333] font-mono ml-auto">{timeAgo}</span>
                      </div>
                      <p className="text-[#666] leading-relaxed">{d.reasoning}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── APY comparison bar chart ─────────────────────────────────── */}
      <div className="card">
        <p className="label-mono mb-4">PROTOCOL APY COMPARISON</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={[
              { name: "Morpho USDC",   apy: 18.4 },
              { name: "Kuru MON/USDC", apy: 32.7 },
              { name: "Ambient USDC",  apy: 14.1 },
              { name: "Kuru MON/WMON", apy: 22.5 },
            ]}
            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
          >
            <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              formatter={(v: number) => [`${v}%`, "APY"]}
              contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12, fontSize: 12, color: "#fff" }}
            />
            <Bar dataKey="apy" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
