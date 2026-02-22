import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import { type Address } from "viem";
import { fetchAllRates, getBestAllocation, blendedApy, type RiskProfile } from "./rateFetcher";
import { decideRebalance } from "./llmAgent";
import { executeRebalance, getOnChainPortfolio } from "./txExecutor";
import { publicClient } from "./rateFetcher";

// ─── Config ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS   = parseInt(process.env.AGENT_POLL_INTERVAL_MS || "4000", 10);
const THRESHOLD_BPS      = parseInt(process.env.REBALANCE_THRESHOLD_BPS  || "50",   10);
const VAULT_ADDRESS      = process.env.NEXT_PUBLIC_VAULT_ADDRESS as Address;

// ─── Tracked users (in production: read from registry or events) ───────────
// For the hackathon demo, populate with testnet wallet addresses

const TRACKED_USERS: Address[] = [
  // Add user wallet addresses here after they deposit
  // e.g. "0xYourTestWallet" as Address
];

// ─── Agent state ───────────────────────────────────────────────────────────

let lastBlockProcessed = 0n;
let cycleCount         = 0;

// ─── Main loop ─────────────────────────────────────────────────────────────

async function runCycle() {
  cycleCount++;
  const blockNumber = await publicClient.getBlockNumber();

  if (blockNumber <= lastBlockProcessed) return;
  lastBlockProcessed = blockNumber;

  console.log(`\n[Agent] ── Cycle ${cycleCount} | Block #${blockNumber} ──────────────`);

  // 1. Fetch current APY rates from all protocols
  const rates = await fetchAllRates();
  console.log(`[Agent] Fetched ${rates.length} protocol rates:`);
  rates.forEach((r) => console.log(`  ${r.name}: ${r.apy.toFixed(2)}% APY`));

  // 2. Process each tracked user
  for (const userAddress of TRACKED_USERS) {
    try {
      await processUser(userAddress, rates, blockNumber);
    } catch (err) {
      console.error(`[Agent] Error processing ${userAddress}:`, err);
    }
  }
}

async function processUser(
  userAddress: Address,
  rates:       Awaited<ReturnType<typeof fetchAllRates>>,
  blockNumber: bigint
) {
  if (!VAULT_ADDRESS || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("[Agent] Vault not deployed — skipping on-chain checks");
    return;
  }

  const onChain = await getOnChainPortfolio(userAddress);
  if (!onChain) return;

  const { state, allocations } = onChain;
  const [balance, riskProfile, , , , isActive] = state as [
    bigint, number, bigint, bigint, bigint, boolean
  ];

  if (!isActive || balance === 0n) {
    console.log(`[Agent] ${userAddress.slice(0, 8)}… not active, skipping`);
    return;
  }

  const allocs = allocations as unknown as Array<{ protocolName: string; basisPoints: bigint }>;

  // Calculate current blended APY from existing allocation
  const currentApy = allocs.reduce((sum, a) => {
    const rate = rates.find((r) => r.name === a.protocolName);
    return sum + (rate?.apy ?? 0) * (Number(a.basisPoints) / 10_000);
  }, 0);

  console.log(`[Agent] ${userAddress.slice(0, 8)}… | Balance: ${Number(balance) / 1e6} USDC | APY: ${currentApy.toFixed(2)}% | Risk: ${riskProfile}`);

  // Ask LLM whether to rebalance
  const decision = await decideRebalance(
    userAddress,
    riskProfile as RiskProfile,
    allocs,
    currentApy,
    rates,
    THRESHOLD_BPS
  );

  console.log(`[Agent] Decision: ${decision.shouldRebalance ? "REBALANCE" : "HOLD"} | ${decision.reasoning}`);

  if (decision.shouldRebalance && decision.newAllocation.length > 0) {
    console.log(`[Agent] Executing rebalance — expected APY: ${decision.expectedApy.toFixed(2)}%`);
    const txHash = await executeRebalance(
      userAddress,
      decision.newAllocation,
      decision.reasoning
    );
    console.log(`[Agent] ✓ Rebalanced | tx: ${txHash}`);
  }
}

// ─── Startup ───────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     DeFi Copilot Agent v0.1.0        ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Chain:           Monad Testnet (10143)`);
  console.log(`Poll interval:   ${POLL_INTERVAL_MS}ms`);
  console.log(`Rebalance threshold: ${THRESHOLD_BPS}bps (${THRESHOLD_BPS / 100}%)`);
  console.log(`Vault:           ${VAULT_ADDRESS || "NOT DEPLOYED"}`);
  console.log(`Tracked users:   ${TRACKED_USERS.length}`);
  console.log("");

  // Run first cycle immediately
  await runCycle();

  // Then poll on interval
  setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error("[Agent] Cycle error:", err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
