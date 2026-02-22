"use client";

import { useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
  usePublicClient,
} from "wagmi";
import { parseUnits } from "viem";
import { CONTRACT_ADDRESSES, VAULT_ABI, ERC20_ABI, MOCK_TOKEN_ABI } from "@/lib/contracts";
import { monadTestnet } from "@/lib/wagmi-config";

export function useVault(address?: `0x${string}`) {
  const [isPending, setIsPending] = useState(false);
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  // ── Read portfolio state ────────────────────────────────────────────────

  const { data: portfolio, refetch: refetchPortfolio } = useReadContract({
    address:      CONTRACT_ADDRESSES.vault,
    abi:          VAULT_ABI,
    functionName: "getPortfolioState",
    args:         address ? [address] : undefined,
    chainId:      monadTestnet.id,
    query: { enabled: !!address && CONTRACT_ADDRESSES.vault !== "0x0000000000000000000000000000000000000000" },
  });

  // ── Read allocations ────────────────────────────────────────────────────

  const { data: allocations, refetch: refetchAllocations } = useReadContract({
    address:      CONTRACT_ADDRESSES.vault,
    abi:          VAULT_ABI,
    functionName: "getAllocations",
    args:         address ? [address] : undefined,
    chainId:      monadTestnet.id,
    query: { enabled: !!address && CONTRACT_ADDRESSES.vault !== "0x0000000000000000000000000000000000000000" },
  });

  // ── Read mETH balance + allowance (18 decimals) ────────────────────────

  const { data: multiData, refetch: refetchToken } = useReadContracts({
    contracts: [
      {
        address:      CONTRACT_ADDRESSES.meth,
        abi:          ERC20_ABI,
        functionName: "balanceOf",
        args:         address ? [address] : ["0x0000000000000000000000000000000000000000"],
      },
      {
        address:      CONTRACT_ADDRESSES.meth,
        abi:          ERC20_ABI,
        functionName: "allowance",
        args:         address
          ? [address, CONTRACT_ADDRESSES.vault]
          : ["0x0000000000000000000000000000000000000000", CONTRACT_ADDRESSES.vault],
      },
    ],
    query: { enabled: !!address },
  });

  const methBalance   = multiData?.[0]?.result as bigint | undefined;
  const methAllowance = multiData?.[1]?.result as bigint | undefined;

  // ── Write: approve ──────────────────────────────────────────────────────

  const { writeContractAsync: approveAsync  } = useWriteContract();
  const { writeContractAsync: depositAsync  } = useWriteContract();
  const { writeContractAsync: withdrawAsync } = useWriteContract();
  const { writeContractAsync: setRiskAsync  } = useWriteContract();
  const { writeContractAsync: faucetAsync   } = useWriteContract();

  // ── Tx state ────────────────────────────────────────────────────────────

  const [depositTxHash,  setDepositTxHash]  = useState<`0x${string}` | undefined>();
  const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
  const [riskTxHash,     setRiskTxHash]     = useState<`0x${string}` | undefined>();
  const [faucetTxHash,   setFaucetTxHash]   = useState<`0x${string}` | undefined>();

  const { isLoading: isDepositing  } = useWaitForTransactionReceipt({ hash: depositTxHash  });
  const { isLoading: isWithdrawing } = useWaitForTransactionReceipt({ hash: withdrawTxHash });
  const { isLoading: isSettingRisk } = useWaitForTransactionReceipt({ hash: riskTxHash     });
  const { isLoading: isFauceting   } = useWaitForTransactionReceipt({ hash: faucetTxHash   });

  // ── deposit(amount) ─────────────────────────────────────────────────────

  const deposit = async (amountStr: string) => {
    if (!address) throw new Error("Wallet not connected");
    const amount = parseUnits(amountStr, 18); // WMON = 18 decimals

    // Approve mETH if needed
    if (!methAllowance || methAllowance < amount) {
      const approveHash = await approveAsync({
        address:      CONTRACT_ADDRESSES.meth,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [CONTRACT_ADDRESSES.vault, amount],
        chainId:      monadTestnet.id,
      });
      // Wait for approval to be confirmed on-chain before depositing
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      } else {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    const hash = await depositAsync({
      address:      CONTRACT_ADDRESSES.vault,
      abi:          VAULT_ABI,
      functionName: "deposit",
      args:         [amount],
      chainId:      monadTestnet.id,
    });
    setDepositTxHash(hash);
    await refetchPortfolio();
    await refetchToken();
    return hash;
  };

  // ── withdraw(amount) ────────────────────────────────────────────────────

  const withdraw = async (amountStr: string) => {
    if (!address) throw new Error("Wallet not connected");
    const amount = parseUnits(amountStr, 18); // WMON = 18 decimals

    const hash = await withdrawAsync({
      address:      CONTRACT_ADDRESSES.vault,
      abi:          VAULT_ABI,
      functionName: "withdraw",
      args:         [amount],
      chainId:      monadTestnet.id,
    });
    setWithdrawTxHash(hash);
    await refetchPortfolio();
    await refetchToken();
    return hash;
  };

  // ── setRiskProfile(level) ───────────────────────────────────────────────

  const setRisk = async (level: 0 | 1 | 2) => {
    if (!address) throw new Error("Wallet not connected");

    const hash = await setRiskAsync({
      address:      CONTRACT_ADDRESSES.vault,
      abi:          VAULT_ABI,
      functionName: "setRiskProfile",
      args:         [level],
      chainId:      monadTestnet.id,
    });
    setRiskTxHash(hash);
    await refetchPortfolio();
    return hash;
  };

  // ── faucet() — mint 100 mETH to caller (once per 24h) ──────────────────

  const claimFaucet = async () => {
    if (!address) throw new Error("Wallet not connected");
    const hash = await faucetAsync({
      address:      CONTRACT_ADDRESSES.meth,
      abi:          MOCK_TOKEN_ABI,
      functionName: "faucet",
      args:         [],
      chainId:      monadTestnet.id,
    });
    setFaucetTxHash(hash);
    await refetchToken();
    return hash;
  };

  const refetch = async () => {
    await Promise.all([refetchPortfolio(), refetchAllocations(), refetchToken()]);
  };

  return {
    portfolio,
    allocations,
    methBalance,
    methAllowance,
    deposit,
    withdraw,
    setRisk,
    claimFaucet,
    isDepositing:  isPending || isDepositing,
    isWithdrawing: isPending || isWithdrawing,
    isSettingRisk: isPending || isSettingRisk,
    isFauceting:   isPending || isFauceting,
    refetch,
  };
}
