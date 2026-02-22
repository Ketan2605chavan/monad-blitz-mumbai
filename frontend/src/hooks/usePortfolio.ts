"use client";

import { useReadContract, useBlockNumber } from "wagmi";
import { CONTRACT_ADDRESSES, VAULT_ABI, DECISION_LOG_ABI } from "@/lib/contracts";
import { monadTestnet } from "@/lib/wagmi-config";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const isDeployed = (addr: string) => addr !== ZERO_ADDR;

export function usePortfolio(address?: `0x${string}`) {
  const contractsDeployed =
    isDeployed(CONTRACT_ADDRESSES.vault) &&
    isDeployed(CONTRACT_ADDRESSES.decisionLog);

  // ── Portfolio state from Vault ──────────────────────────────────────────

  const { data: portfolio, isLoading: loadingPortfolio } = useReadContract({
    address:      CONTRACT_ADDRESSES.vault,
    abi:          VAULT_ABI,
    functionName: "getPortfolioState",
    args:         address ? [address] : undefined,
    chainId:      monadTestnet.id,
    query: {
      enabled:          !!address && contractsDeployed,
      refetchInterval:  8_000, // refresh every 8 s
    },
  });

  // ── Allocations from Vault ──────────────────────────────────────────────

  const { data: allocations, isLoading: loadingAlloc } = useReadContract({
    address:      CONTRACT_ADDRESSES.vault,
    abi:          VAULT_ABI,
    functionName: "getAllocations",
    args:         address ? [address] : undefined,
    chainId:      monadTestnet.id,
    query: {
      enabled:          !!address && contractsDeployed,
      refetchInterval:  8_000,
    },
  });

  // ── Decision history from DecisionLog ──────────────────────────────────

  const { data: decisions, isLoading: loadingDecisions } = useReadContract({
    address:      CONTRACT_ADDRESSES.decisionLog,
    abi:          DECISION_LOG_ABI,
    functionName: "getDecisionHistory",
    args:         address ? [address] : undefined,
    chainId:      monadTestnet.id,
    query: {
      enabled:          !!address && contractsDeployed,
      refetchInterval:  8_000,
    },
  });

  // ── Current block (for freshness display) ──────────────────────────────

  const { data: blockNumber } = useBlockNumber({
    chainId: monadTestnet.id,
    query:   { refetchInterval: 500 }, // Monad produces a block every ~0.4s
  });

  return {
    portfolio:  portfolio as {
      balance:                 bigint;
      riskProfile:             bigint;
      depositTimestamp:        bigint;
      lastRebalanceTimestamp:  bigint;
      totalYieldEarned:        bigint;
      isActive:                boolean;
    } | undefined,
    allocations: allocations as Array<{
      protocol:     string;
      basisPoints:  bigint;
      protocolName: string;
    }> | undefined,
    decisions: decisions as Array<{
      user:        string;
      agent:       string;
      action:      string;
      reasoning:   string;
      timestamp:   bigint;
      blockNumber: bigint;
    }> | undefined,
    blockNumber,
    isLoading: loadingPortfolio || loadingAlloc || loadingDecisions,
    contractsDeployed,
  };
}
