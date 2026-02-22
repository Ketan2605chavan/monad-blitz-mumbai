// ─── Contract Addresses ────────────────────────────────────────────────────

export const CONTRACT_ADDRESSES = {
  vault:         process.env.NEXT_PUBLIC_VAULT_ADDRESS         as `0x${string}`,
  decisionLog:   process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS  as `0x${string}`,
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS as `0x${string}`,
  // mETH = deployed MockToken.sol — vault deposit token (18 decimals)
  meth:          process.env.NEXT_PUBLIC_METH_ADDRESS          as `0x${string}`,
  wmon:          process.env.NEXT_PUBLIC_WMON_ADDRESS          as `0x${string}`,
} as const;

// Convenience: the token the vault accepts
export const VAULT_TOKEN = {
  key:      "meth" as const,
  symbol:   "mETH",
  name:     "Mock ETH",
  decimals: 18,
} as const;

// ─── Vault ABI ─────────────────────────────────────────────────────────────

export const VAULT_ABI = [
  // deposit
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // withdraw
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // setRiskProfile
  {
    inputs: [{ name: "profile", type: "uint8" }],
    name: "setRiskProfile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getPortfolioState
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getPortfolioState",
    outputs: [
      { name: "balance",                  type: "uint256" },
      { name: "riskProfile",              type: "uint8"   },
      { name: "depositTimestamp",         type: "uint256" },
      { name: "lastRebalanceTimestamp",   type: "uint256" },
      { name: "totalYieldEarned",         type: "uint256" },
      { name: "isActive",                 type: "bool"    },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getAllocations
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getAllocations",
    outputs: [
      {
        components: [
          { name: "protocol",     type: "address" },
          { name: "basisPoints",  type: "uint256" },
          { name: "protocolName", type: "string"  },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // totalValueLocked
  {
    inputs: [],
    name: "totalValueLocked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "user",      type: "address" },
      { indexed: false, name: "amount",    type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "Deposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "user",      type: "address" },
      { indexed: false, name: "amount",    type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "Withdrawn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: "user",      type: "address" },
      { indexed: true,  name: "agent",     type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "Rebalanced",
    type: "event",
  },
] as const;

// ─── ERC-20 ABI (minimal) ─────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── DecisionLog ABI ───────────────────────────────────────────────────────

export const DECISION_LOG_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getDecisionHistory",
    outputs: [
      {
        components: [
          { name: "user",        type: "address" },
          { name: "agent",       type: "address" },
          { name: "action",      type: "string"  },
          { name: "reasoning",   type: "string"  },
          { name: "timestamp",   type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getDecisionCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── MockToken ABI (faucet) ────────────────────────────────────────────────

export const MOCK_TOKEN_ABI = [
  ...ERC20_ABI,
  {
    inputs: [],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "faucetCooldownRemaining",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "faucetEnabled",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── Protocol Yield Sources (mock APY for demo) ────────────────────────────

export const YIELD_SOURCES = [
  { id: "morpho-usdc",    name: "Morpho USDC",   protocol: "Morpho",   apy: 18.4, risk: "low",    tvl: "$2.1M" },
  { id: "kuru-mon-usdc",  name: "Kuru MON/USDC", protocol: "Kuru",     apy: 32.7, risk: "medium", tvl: "$890K" },
  { id: "ambient-stable", name: "Ambient USDC",  protocol: "Ambient",  apy: 14.1, risk: "low",    tvl: "$3.4M" },
  { id: "kuru-mon-wmon",  name: "Kuru MON/WMON", protocol: "Kuru",     apy: 22.5, risk: "medium", tvl: "$1.2M" },
] as const;
