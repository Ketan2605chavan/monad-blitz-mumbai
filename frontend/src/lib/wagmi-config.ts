import { defineChain } from "viem";
import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, injectedWallet, coinbaseWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
} from "wagmi/chains";

// ─── Monad Testnet ─────────────────────────────────────────────────────────

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "d01293ef3d00d2195e1d92ba04028309";

// ─── Wagmi config via RainbowKit ───────────────────────────────────────────

export const wagmiConfig = getDefaultConfig({
  appName:   "DeFi Copilot",
  projectId,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet, coinbaseWallet],
    },
    {
      groupName: "More",
      wallets: [walletConnectWallet],
    },
  ],
  chains: [monadTestnet, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia],
  transports: {
    [monadTestnet.id]:    http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"),
    [sepolia.id]:         http(),
    [baseSepolia.id]:     http(),
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
  },
  ssr: true,
});

// ─── Supported chains for cross-chain swap ────────────────────────────────

export const SUPPORTED_CHAINS = [
  {
    id:     monadTestnet.id,
    name:   "Monad Testnet",
    symbol: "MON",
    logo:   "/chains/monad.svg",
    rpc:    process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    tokens: [
      { symbol: "MON",  name: "Monad",       address: "native", decimals: 18, logo: "/tokens/mon.svg" },
      { symbol: "mETH", name: "Mock ETH",    address: process.env.NEXT_PUBLIC_METH_ADDRESS  || "", decimals: 18, logo: "/tokens/meth.svg" },
      { symbol: "WMON", name: "Wrapped MON", address: process.env.NEXT_PUBLIC_WMON_ADDRESS  || "", decimals: 18, logo: "/tokens/wmon.svg" },
    ],
  },
  {
    id:     sepolia.id,
    name:   "Ethereum Sepolia",
    symbol: "ETH",
    logo:   "/chains/eth.svg",
    rpc:    "https://rpc.sepolia.org",
    tokens: [
      { symbol: "ETH",  name: "Ethereum",  address: "native", decimals: 18, logo: "/tokens/eth.svg"  },
      { symbol: "USDC", name: "USD Coin",  address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6,  logo: "/tokens/usdc.svg" },
    ],
  },
  {
    id:     baseSepolia.id,
    name:   "Base Sepolia",
    symbol: "ETH",
    logo:   "/chains/base.svg",
    rpc:    "https://sepolia.base.org",
    tokens: [
      { symbol: "ETH",  name: "Ethereum", address: "native", decimals: 18, logo: "/tokens/eth.svg"  },
      { symbol: "USDC", name: "USD Coin", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6,  logo: "/tokens/usdc.svg" },
    ],
  },
  {
    id:     arbitrumSepolia.id,
    name:   "Arbitrum Sepolia",
    symbol: "ETH",
    logo:   "/chains/arb.svg",
    rpc:    "https://sepolia-rollup.arbitrum.io/rpc",
    tokens: [
      { symbol: "ETH",  name: "Ethereum", address: "native", decimals: 18, logo: "/tokens/eth.svg"  },
      { symbol: "USDC", name: "USD Coin", address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6,  logo: "/tokens/usdc.svg" },
    ],
  },
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];
