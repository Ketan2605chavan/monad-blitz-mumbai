import { parseIntent, type ParsedIntent } from "./llmAgent";

// ─── NL command handler ────────────────────────────────────────────────────

export interface CommandResult {
  intent:  ParsedIntent;
  handled: boolean;
  output:  string;
}

export async function handleNLCommand(
  message:     string,
  userAddress: string
): Promise<CommandResult> {
  const intent = await parseIntent(message);

  console.log(`[NLParser] Intent: ${intent.action} | ${intent.message}`);

  switch (intent.action) {
    case "deposit":
      return {
        intent,
        handled: true,
        output:  `Deposit intent: ${intent.amount ?? "?"} ${intent.token ?? "USDC"}. Ready to execute — user must sign the approve+deposit transactions.`,
      };

    case "withdraw":
      return {
        intent,
        handled: true,
        output:  `Withdraw intent: ${intent.amount ?? "all"} USDC. User must sign the withdrawal transaction.`,
      };

    case "swap":
      return {
        intent,
        handled: true,
        output:  `Swap intent: ${intent.amount ?? "?"} ${intent.token ?? "MON"} → ${intent.toToken ?? "USDC"}. Routing through available DEX.`,
      };

    case "rebalance":
      return {
        intent,
        handled: true,
        output:  "Rebalance intent triggered. Agent will evaluate rates and execute on-chain if APY improvement exceeds threshold.",
      };

    case "set_risk":
      return {
        intent,
        handled: true,
        output:  `Risk profile intent: ${["Conservative", "Balanced", "Aggressive"][intent.riskLevel ?? 1]}. User must sign the setRiskProfile transaction.`,
      };

    case "query":
    default:
      return {
        intent,
        handled: true,
        output:  intent.message,
      };
  }
}

// ─── Quick intent detection without LLM (pattern matching) ────────────────

const PATTERNS = [
  { pattern: /deposit|add|put.*in/i,                     action: "deposit"   },
  { pattern: /withdraw|take out|remove/i,                action: "withdraw"  },
  { pattern: /swap|exchange|convert|trade/i,             action: "swap"      },
  { pattern: /rebalance|optimize|reallocate/i,           action: "rebalance" },
  { pattern: /conservative|balanced|aggressive|risk/i,   action: "set_risk"  },
  { pattern: /show|display|what.*portfolio|balance|how much/i, action: "query" },
] as const;

export function quickDetect(message: string): string {
  for (const { pattern, action } of PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return "query";
}
