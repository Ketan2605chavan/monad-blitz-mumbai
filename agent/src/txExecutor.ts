import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "./rateFetcher";
import type { ProtocolRate } from "./rateFetcher";

// ─── Agent wallet ──────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

export function createAgentWallet() {
  if (!PRIVATE_KEY || PRIVATE_KEY === "0x-your-agent-private-key-here") {
    throw new Error("AGENT_PRIVATE_KEY not set in .env");
  }
  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet  = createWalletClient({
    account,
    chain: {
      id:   10143,
      name: "Monad Testnet",
      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
      rpcUrls: {
        default: {
          http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"],
        },
      },
    },
    transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"),
  });
  return { account, wallet };
}

// ─── Vault ABI fragments ───────────────────────────────────────────────────

const VAULT_ABI = parseAbi([
  "function rebalance(address user, address[] protocols, uint256[] basisPoints, string[] protocolNames, string reasoning) external",
  "function getAllocations(address user) external view returns ((address protocol, uint256 basisPoints, string protocolName)[])",
  "function getPortfolioState(address user) external view returns (uint256 balance, uint8 riskProfile, uint256 depositTimestamp, uint256 lastRebalanceTimestamp, uint256 totalYieldEarned, bool isActive)",
]);

// ─── Execute rebalance ─────────────────────────────────────────────────────

export async function executeRebalance(
  userAddress: Address,
  allocation:  { protocol: ProtocolRate; basisPoints: number }[],
  reasoning:   string
): Promise<`0x${string}`> {
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS as Address;
  if (!vaultAddress || vaultAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("NEXT_PUBLIC_VAULT_ADDRESS not set — deploy contracts first");
  }

  const { wallet, account } = createAgentWallet();

  const protocols     = allocation.map((a) => a.protocol.address as Address);
  const basisPoints   = allocation.map((a) => BigInt(a.basisPoints));
  const protocolNames = allocation.map((a) => a.protocol.name);

  const hash = await wallet.writeContract({
    address:      vaultAddress,
    abi:          VAULT_ABI,
    functionName: "rebalance",
    args:         [userAddress, protocols, basisPoints, protocolNames, reasoning],
    account,
  });

  console.log(`[TxExecutor] Rebalance tx sent: ${hash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[TxExecutor] Confirmed in block ${receipt.blockNumber}`);

  return hash;
}

// ─── Fetch current on-chain portfolio state ────────────────────────────────

export async function getOnChainPortfolio(userAddress: Address) {
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS as Address;
  if (!vaultAddress || vaultAddress === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  const [state, allocations] = await Promise.all([
    publicClient.readContract({
      address:      vaultAddress,
      abi:          VAULT_ABI,
      functionName: "getPortfolioState",
      args:         [userAddress],
    }),
    publicClient.readContract({
      address:      vaultAddress,
      abi:          VAULT_ABI,
      functionName: "getAllocations",
      args:         [userAddress],
    }),
  ]);

  return { state, allocations };
}
