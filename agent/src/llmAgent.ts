import OpenAI from "openai";
import {
  type ProtocolRate,
  type RiskProfile,
  blendedApy,
  getBestAllocation,
} from "./rateFetcher";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RebalanceDecision {
  shouldRebalance: boolean;
  reasoning:       string;
  newAllocation:   { protocol: ProtocolRate; basisPoints: number }[];
  expectedApy:     number;
}

// ─── Ask the LLM whether to rebalance ─────────────────────────────────────

export async function decideRebalance(
  userAddress:        string,
  riskProfile:        RiskProfile,
  currentAllocation:  { protocolName: string; basisPoints: bigint }[],
  currentApy:         number,
  rates:              ProtocolRate[],
  threshold:          number   // basis points, e.g. 50 = 0.5%
): Promise<RebalanceDecision> {
  const bestAlloc    = getBestAllocation(rates, riskProfile);
  const bestApy      = blendedApy(bestAlloc);
  const apyDelta     = bestApy - currentApy;
  const deltaPercent = apyDelta * 100;   // in basis points

  // If delta is below threshold, skip the LLM call for efficiency
  if (Math.abs(apyDelta) < threshold / 100) {
    return {
      shouldRebalance: false,
      reasoning:       `APY delta (${apyDelta.toFixed(2)}%) is below the ${(threshold / 100).toFixed(2)}% threshold. No rebalance needed.`,
      newAllocation:   bestAlloc,
      expectedApy:     bestApy,
    };
  }

  const prompt = `
You are a DeFi yield optimization agent on Monad blockchain.

User: ${userAddress}
Risk profile: ${["Conservative", "Balanced", "Aggressive"][riskProfile]}

Current allocation:
${currentAllocation.map((a) => `  - ${a.protocolName}: ${Number(a.basisPoints) / 100}%`).join("\n") || "  (none — first allocation)"}
Current blended APY: ${currentApy.toFixed(2)}%

Available protocol rates:
${rates.map((r) => `  - ${r.name} (${r.protocol}): APY ${r.apy.toFixed(2)}%, TVL $${(r.tvl / 1e6).toFixed(1)}M, risk: ${r.risk}`).join("\n")}

Recommended new allocation (pre-computed, optimize if needed):
${bestAlloc.map((a) => `  - ${a.protocol.name}: ${a.basisPoints / 100}%`).join("\n")}
Recommended blended APY: ${bestApy.toFixed(2)}%
APY improvement: +${apyDelta.toFixed(2)}%

Should we rebalance? Reply ONLY as valid JSON:
{
  "shouldRebalance": boolean,
  "reasoning": "1–2 sentence explanation for the decision log"
}
`.trim();

  try {
    const msg = await client.chat.completions.create({
      model:      "gpt-4o-mini",   // fast + cheap for agent decisions
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    });

    const text    = (msg.choices[0].message.content ?? "").trim();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed  = JSON.parse(jsonStr) as { shouldRebalance: boolean; reasoning: string };

    return {
      shouldRebalance: parsed.shouldRebalance ?? apyDelta >= threshold / 100,
      reasoning:       parsed.reasoning ?? `Rebalancing to improve APY by ${apyDelta.toFixed(2)}%.`,
      newAllocation:   bestAlloc,
      expectedApy:     bestApy,
    };
  } catch {
    // Fallback: rebalance if delta exceeds threshold
    return {
      shouldRebalance: apyDelta >= threshold / 100,
      reasoning:       `Auto-rebalancing: detected ${apyDelta.toFixed(2)}% APY improvement opportunity.`,
      newAllocation:   bestAlloc,
      expectedApy:     bestApy,
    };
  }
}

// ─── Parse natural-language user intents ──────────────────────────────────

export interface ParsedIntent {
  action:     "deposit" | "withdraw" | "swap" | "rebalance" | "query" | "set_risk";
  amount?:    string;
  token?:     string;
  toToken?:   string;
  riskLevel?: 0 | 1 | 2;
  message:    string;
}

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const prompt = `
Parse this DeFi user intent and return JSON.

User message: "${userMessage}"

Reply ONLY as valid JSON:
{
  "action": "deposit|withdraw|swap|rebalance|query|set_risk",
  "amount": "numeric string or null",
  "token": "token symbol or null",
  "toToken": "target token for swaps or null",
  "riskLevel": 0|1|2 or null,
  "message": "human-friendly confirmation sentence"
}
`.trim();

  try {
    const msg = await client.chat.completions.create({
      model:      "gpt-4o-mini",
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    });

    const text    = (msg.choices[0].message.content ?? "").trim();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    return JSON.parse(jsonStr) as ParsedIntent;
  } catch {
    return {
      action:  "query",
      message: "I couldn't parse your request. Please try again.",
    };
  }
}
