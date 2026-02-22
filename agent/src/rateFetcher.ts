import { createPublicClient, http } from "viem";
import axios from "axios";

// ─── Monad Testnet client ──────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

export const publicClient = createPublicClient({
  chain: {
    id:   10143,
    name: "Monad Testnet",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  },
  transport: http(RPC_URL),
});

// ─── Protocol types ────────────────────────────────────────────────────────

export interface ProtocolRate {
  id:          string;
  name:        string;
  protocol:    string;
  address:     string;
  apy:         number;     // annual percentage yield (%)
  tvl:         number;     // total value locked (USD)
  risk:        "low" | "medium" | "high";
  lastUpdated: number;     // unix ms
}

// ─── Mock rates for testnet demo ───────────────────────────────────────────
// In production: read from on-chain lending/AMM contracts directly

function mockApy(base: number): number {
  // Add ±10% noise to simulate market movement
  return base * (1 + (Math.random() - 0.5) * 0.2);
}

export async function fetchAllRates(): Promise<ProtocolRate[]> {
  const now = Date.now();

  // ── Morpho USDC (lending) ─────────────────────────────────────────────
  const morphoApy = mockApy(18.4);

  // ── Kuru Exchange (AMM LP) ────────────────────────────────────────────
  const kuruMonUsdcApy = mockApy(32.7);
  const kuruMonWmonApy = mockApy(22.5);

  // ── Ambient Finance (CL AMM) ──────────────────────────────────────────
  const ambientApy = mockApy(14.1);

  return [
    {
      id:          "morpho-usdc",
      name:        "Morpho USDC",
      protocol:    "Morpho",
      address:     process.env.NEXT_PUBLIC_MORPHO_ADDRESS || "0x0000000000000000000000000000000000000000",
      apy:         morphoApy,
      tvl:         2_100_000,
      risk:        "low",
      lastUpdated: now,
    },
    {
      id:          "kuru-mon-usdc",
      name:        "Kuru MON/USDC LP",
      protocol:    "Kuru",
      address:     process.env.NEXT_PUBLIC_KURU_ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000",
      apy:         kuruMonUsdcApy,
      tvl:         890_000,
      risk:        "medium",
      lastUpdated: now,
    },
    {
      id:          "kuru-mon-wmon",
      name:        "Kuru MON/WMON LP",
      protocol:    "Kuru",
      address:     process.env.NEXT_PUBLIC_KURU_ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000",
      apy:         kuruMonWmonApy,
      tvl:         1_200_000,
      risk:        "medium",
      lastUpdated: now,
    },
    {
      id:          "ambient-usdc",
      name:        "Ambient USDC",
      protocol:    "Ambient",
      address:     process.env.NEXT_PUBLIC_AMBIENT_ADDRESS || "0x0000000000000000000000000000000000000000",
      apy:         ambientApy,
      tvl:         3_400_000,
      risk:        "low",
      lastUpdated: now,
    },
  ];
}

// ─── Get best yield for a given risk profile ───────────────────────────────

export type RiskProfile = 0 | 1 | 2; // 0=Conservative, 1=Balanced, 2=Aggressive

const RISK_FILTER: Record<RiskProfile, ("low" | "medium" | "high")[]> = {
  0: ["low"],
  1: ["low", "medium"],
  2: ["low", "medium", "high"],
};

export function getBestAllocation(
  rates: ProtocolRate[],
  riskProfile: RiskProfile
): { protocol: ProtocolRate; basisPoints: number }[] {
  const allowed = rates.filter((r) => RISK_FILTER[riskProfile].includes(r.risk));
  if (allowed.length === 0) return [];

  // Sort by APY descending
  const sorted = [...allowed].sort((a, b) => b.apy - a.apy);

  // Simple allocation strategy:
  // - Top protocol: 50%
  // - Second: 30%
  // - Rest: 20% split equally
  const allocations: { protocol: ProtocolRate; basisPoints: number }[] = [];

  if (sorted.length === 1) {
    allocations.push({ protocol: sorted[0], basisPoints: 10_000 });
  } else if (sorted.length === 2) {
    allocations.push({ protocol: sorted[0], basisPoints: 6_000 });
    allocations.push({ protocol: sorted[1], basisPoints: 4_000 });
  } else {
    allocations.push({ protocol: sorted[0], basisPoints: 5_000 });
    allocations.push({ protocol: sorted[1], basisPoints: 3_000 });
    const remainder = 10_000 - 5_000 - 3_000;
    const rest      = sorted.slice(2);
    const perEach   = Math.floor(remainder / rest.length);
    for (let i = 0; i < rest.length; i++) {
      allocations.push({
        protocol:    rest[i],
        basisPoints: i === rest.length - 1 ? remainder - perEach * i : perEach,
      });
    }
  }

  return allocations;
}

// ─── Calculate blended APY ─────────────────────────────────────────────────

export function blendedApy(
  allocation: { protocol: ProtocolRate; basisPoints: number }[]
): number {
  return allocation.reduce(
    (sum, a) => sum + (a.protocol.apy * a.basisPoints) / 10_000,
    0
  );
}
