"use client";

import { useAccount } from "wagmi";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, Clock, Activity } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { clsx } from "clsx";

// ─── Mock yield history (replace with on-chain data) ─────────────────────

const YIELD_HISTORY = Array.from({ length: 14 }, (_, i) => ({
  day:   `D${i + 1}`,
  value: 10000 + Math.random() * 500 * (i + 1) * 0.3,
  yield: 2 + Math.random() * 4,
}));

const PROTOCOL_COLORS: Record<string, string> = {
  Morpho:  "#ffffff",
  Kuru:    "#888888",
  Ambient: "#444444",
  Cash:    "#222222",
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
  const apy          = allocations?.length ? 18.4 : 0; // from yield sources
  const riskProfile  = portfolio?.riskProfile != null ? Number(portfolio.riskProfile) : 1;

  // Build pie data from allocations
  const pieData = allocations?.length
    ? allocations.map((a: { protocolName: string; basisPoints: bigint }) => ({
        name:  a.protocolName,
        value: Number(a.basisPoints) / 100,
      }))
    : [
        { name: "Morpho",  value: 50 },
        { name: "Kuru",    value: 30 },
        { name: "Ambient", value: 20 },
      ];

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
          label="VAULT BALANCE"
          value={`${balance.toFixed(4)} mETH`}
          sub="mETH deposited in vault"
        />
        <StatCard
          icon={TrendingUp}
          label="YIELD EARNED"
          value={`${yieldEarned.toFixed(6)} mETH`}
          sub="Total harvested yield"
          positive
        />
        <StatCard
          icon={Percent}
          label="CURRENT APY"
          value={`${apy.toFixed(1)}%`}
          sub="Blended rate"
          positive
        />
        <StatCard
          icon={Clock}
          label="LAST REBALANCE"
          value={portfolio?.lastRebalanceTimestamp
            ? new Date(Number(portfolio.lastRebalanceTimestamp) * 1000).toLocaleDateString()
            : "—"}
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
                  <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "#444", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ffffff"
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
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
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
            {pieData.map((d) => (
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

      {/* ── Decision log ────────────────────────────────────────────── */}
      <div className="card">
        <p className="label-mono mb-4">AGENT DECISION LOG</p>
        {decisions && decisions.length > 0 ? (
          <div className="space-y-3">
            {[...decisions].reverse().slice(0, 5).map((d: {
              action: string; reasoning: string; timestamp: bigint; blockNumber: bigint;
            }, i: number) => (
              <div key={i} className="flex gap-3 text-xs border-b border-[#111] pb-3 last:border-0 last:pb-0">
                <div className="w-1 bg-white/20 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="badge-white">{d.action}</span>
                    <span className="text-[#444] font-mono">
                      Block #{d.blockNumber?.toString()}
                    </span>
                  </div>
                  <p className="text-[#666] leading-relaxed">{d.reasoning}</p>
                  <p className="text-[#333] font-mono">
                    {new Date(Number(d.timestamp) * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[#444] text-xs font-mono">
              No decisions yet — deposit funds to start the agent
            </p>
          </div>
        )}
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
