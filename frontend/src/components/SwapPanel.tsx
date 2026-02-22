"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount, useBalance, useSendTransaction,
  useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import { parseEther, parseUnits } from "viem";
import {
  ArrowUpDown, ChevronDown, Loader2, CheckCircle,
  AlertCircle, ExternalLink, TrendingUp, RefreshCw,
} from "lucide-react";
import { SUPPORTED_CHAINS, type SupportedChain, monadTestnet } from "@/lib/wagmi-config";
import { CONTRACT_ADDRESSES, MOCK_TOKEN_ABI } from "@/lib/contracts";
import { clsx } from "clsx";

type Token = SupportedChain["tokens"][number];

// ─── Simulated live rate engine ────────────────────────────────────────────
// Base: 1 MON ≈ 1800 mETH (simulates MON/$1.80 · mETH/$0.001)
const BASE_RATE     = 1800;
const RATE_VARIANCE = 0.012; // ±1.2% random walk per tick

function nextRate(prev: number) {
  const delta = prev * RATE_VARIANCE * (Math.random() * 2 - 1);
  return Math.max(1500, Math.min(2200, prev + delta));
}

// ─── Chain + token selector ────────────────────────────────────────────────

function ChainTokenSelector({
  label, chain, token, amount,
  onChainChange, onTokenChange, onAmountChange, readOnly,
}: {
  label: string;
  chain: SupportedChain;
  token: Token;
  amount: string;
  onChainChange: (c: SupportedChain) => void;
  onTokenChange: (t: Token) => void;
  onAmountChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);

  return (
    <div className="card space-y-3">
      <p className="label-mono">{label}</p>
      <div className="relative">
        <button
          onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
          className="w-full flex items-center justify-between bg-[#0a0a0a] border border-[#1f1f1f]
                     hover:border-[#333] px-3 py-2.5 rounded-xl text-sm transition-colors"
        >
          <span className="font-medium">{chain.name}</span>
          <ChevronDown size={14} className={clsx("text-[#555] transition-transform", chainOpen && "rotate-180")} />
        </button>
        {chainOpen && (
          <div className="absolute top-full mt-1 w-full bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden z-20 shadow-xl">
            {SUPPORTED_CHAINS.map((c) => (
              <button key={c.id}
                onClick={() => { onChainChange(c); setChainOpen(false); onTokenChange(c.tokens[0]); }}
                className={clsx("w-full flex items-center px-3 py-2.5 text-sm hover:bg-[#1a1a1a] transition-colors", c.id === chain.id && "bg-white/5")}
              >
                <span className="text-[#888] font-mono text-xs mr-2">{c.symbol}</span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <button
            onClick={() => { setTokenOpen(!tokenOpen); setChainOpen(false); }}
            className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1f1f1f]
                       hover:border-[#333] px-3 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
          >
            <span className="font-medium">{token.symbol}</span>
            <ChevronDown size={12} className={clsx("text-[#555] transition-transform", tokenOpen && "rotate-180")} />
          </button>
          {tokenOpen && (
            <div className="absolute top-full mt-1 bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden z-20 shadow-xl min-w-[140px]">
              {chain.tokens.map((t) => (
                <button key={t.symbol}
                  onClick={() => { onTokenChange(t); setTokenOpen(false); }}
                  className={clsx("w-full flex items-center px-3 py-2.5 text-sm hover:bg-[#1a1a1a] transition-colors", t.symbol === token.symbol && "bg-white/5")}
                >
                  <span className="font-mono text-xs text-[#888] mr-2">{t.symbol}</span>
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="number" min="0" step="any" placeholder="0.00"
          value={amount}
          onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
          readOnly={readOnly}
          className={clsx(
            "flex-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm",
            "text-right font-mono outline-none transition-colors",
            readOnly ? "text-[#555] cursor-default" : "text-white focus:border-[#444]"
          )}
        />
      </div>
    </div>
  );
}

// ─── Main SwapPanel ────────────────────────────────────────────────────────

export default function SwapPanel() {
  const { address, isConnected } = useAccount();

  const [fromChain, setFromChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [toChain,   setToChain]   = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [fromToken, setFromToken] = useState<Token>(SUPPORTED_CHAINS[0].tokens[0]); // MON
  const [toToken,   setToToken]   = useState<Token>(SUPPORTED_CHAINS[0].tokens[1]); // mETH
  const [amount,    setAmount]    = useState("");
  const [status,       setStatus]       = useState<"idle"|"pending"|"success"|"error">("idle");
  const [txHash,       setTxHash]       = useState<`0x${string}` | undefined>();
  const [errMsg,       setErrMsg]       = useState("");
  const [swapResult,   setSwapResult]   = useState<{ from: string; fromSym: string; to: string; toSym: string } | null>(null);

  // Live rate state
  const [rate,       setRate]       = useState(BASE_RATE);
  const [rateChange, setRateChange] = useState<"up"|"down"|"flat">("flat");
  const [ratePrev,   setRatePrev]   = useState(BASE_RATE);

  // Tick rate every 3s
  useEffect(() => {
    const id = setInterval(() => {
      setRate((prev) => {
        const next = nextRate(prev);
        setRatePrev(prev);
        setRateChange(next > prev ? "up" : next < prev ? "down" : "flat");
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const isMONtoMETH =
    fromChain.id === monadTestnet.id &&
    toChain.id   === monadTestnet.id &&
    fromToken.symbol === "MON" &&
    toToken.symbol   === "mETH";

  const isMETHtoMON =
    fromChain.id === monadTestnet.id &&
    toChain.id   === monadTestnet.id &&
    fromToken.symbol === "mETH" &&
    toToken.symbol   === "MON";

  const { data: balance } = useBalance({
    address,
    token: fromToken.address === "native" ? undefined : fromToken.address as `0x${string}`,
    chainId: fromChain.id,
    query: { enabled: !!address },
  });

  const { sendTransactionAsync }               = useSendTransaction();
  const { writeContractAsync: mintAsync }      = useWriteContract();
  const { writeContractAsync: transferAsync }  = useWriteContract();
  const { isLoading: isConfirming }            = useWaitForTransactionReceipt({ hash: txHash });

  // Calculate output amount
  const estimate = (() => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    const n = parseFloat(amount);
    if (isMONtoMETH) return (n * rate).toFixed(4);
    if (isMETHtoMON) return (n / rate).toFixed(6);
    const isCross = fromChain.id !== toChain.id;
    return (n * (isCross ? 0.998 : 0.997)).toFixed(4);
  })();

  const flipChains = useCallback(() => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount("");
  }, [fromChain, toChain, fromToken, toToken]);

  const executeSwap = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setStatus("pending");
    setErrMsg("");
    setSwapResult(null);

    // Capture estimate NOW before amount is cleared
    const capturedFrom    = amount;
    const capturedFromSym = fromToken.symbol;
    const capturedTo      = estimate;
    const capturedToSym   = toToken.symbol;

    try {
      let hash: `0x${string}`;

      if (isMONtoMETH) {
        // Mint mETH proportional to MON input at live rate
        const outAmount = parseUnits((parseFloat(amount) * rate).toFixed(6), 18);
        hash = await mintAsync({
          address:      CONTRACT_ADDRESSES.meth,
          abi:          MOCK_TOKEN_ABI,
          functionName: "mint",
          args:         [address, outAmount],
          chainId:      monadTestnet.id,
        });
      } else if (isMETHtoMON) {
        // Burn mETH by transferring to dead address — removes from wallet
        const burnAmount = parseUnits(parseFloat(amount).toFixed(6), 18);
        hash = await transferAsync({
          address:      CONTRACT_ADDRESSES.meth,
          abi:          MOCK_TOKEN_ABI,
          functionName: "transfer",
          args:         ["0x000000000000000000000000000000000000dEaD", burnAmount],
          chainId:      monadTestnet.id,
        });
      } else {
        // Other pairs: demo tx
        hash = await sendTransactionAsync({
          to:      address,
          value:   0n,
          data:    "0x",
          chainId: fromChain.id,
        });
      }

      setTxHash(hash);
      setSwapResult({ from: capturedFrom, fromSym: capturedFromSym, to: capturedTo, toSym: capturedToSym });
      setStatus("success");
      setAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setErrMsg(msg.slice(0, 160));
      setStatus("error");
    }
  };

  const isCrossChain = fromChain.id !== toChain.id;

  return (
    <div className="flex-1 flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-md space-y-3">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-2">
          <h2 className="text-lg font-semibold">Swap</h2>
          <p className="text-xs text-[#555] mt-0.5 font-mono">
            MON ↔ mETH · Real-time rate · Monad Testnet
          </p>
        </div>

        {/* ── Live rate ticker ─────────────────────────────────────── */}
        {(isMONtoMETH || isMETHtoMON) && (
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-green-400" />
              <span className="text-xs text-[#555] font-mono">LIVE RATE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                "font-mono text-sm font-semibold transition-colors",
                rateChange === "up"   && "text-green-400",
                rateChange === "down" && "text-red-400",
                rateChange === "flat" && "text-white",
              )}>
                1 MON = {rate.toFixed(2)} mETH
              </span>
              <RefreshCw size={10} className="text-[#444] animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>
        )}

        {/* ── From ─────────────────────────────────────────────────── */}
        <ChainTokenSelector
          label="FROM"
          chain={fromChain}
          token={fromToken}
          amount={amount}
          onChainChange={(c) => { setFromChain(c); setFromToken(c.tokens[0]); }}
          onTokenChange={setFromToken}
          onAmountChange={(v) => { setAmount(v); setStatus("idle"); }}
        />

        {balance && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#444]">Balance</span>
            <button
              className="text-xs font-mono text-[#666] hover:text-white transition-colors"
              onClick={() => setAmount(balance.formatted)}
            >
              {parseFloat(balance.formatted).toFixed(4)} {fromToken.symbol} · MAX
            </button>
          </div>
        )}

        {/* ── Flip ─────────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <button
            onClick={flipChains}
            className="w-9 h-9 bg-[#111] border border-[#1f1f1f] hover:border-[#333]
                       rounded-xl flex items-center justify-center transition-all hover:rotate-180 duration-300"
          >
            <ArrowUpDown size={14} className="text-[#555]" />
          </button>
        </div>

        {/* ── To ───────────────────────────────────────────────────── */}
        <ChainTokenSelector
          label="TO (ESTIMATED)"
          chain={toChain}
          token={toToken}
          amount={estimate}
          onChainChange={(c) => { setToChain(c); setToToken(c.tokens[0]); }}
          onTokenChange={setToToken}
          readOnly
        />

        {/* ── Route + fee info ─────────────────────────────────────── */}
        {amount && parseFloat(amount) > 0 && (
          <div className="card text-xs space-y-2">
            <p className="label-mono">ROUTE</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge-white">{fromChain.name}</span>
              <span className="text-[#444]">→</span>
              <span className="badge-gray">
                {isMONtoMETH || isMETHtoMON ? "MockToken Mint" : isCrossChain ? "Bridge" : "Kuru DEX"}
              </span>
              <span className="text-[#444]">→</span>
              <span className="badge-white">{toChain.name}</span>
            </div>
            <div className="flex items-center justify-between text-[#555]">
              <span>You receive</span>
              <span className="font-mono text-white">{estimate} {toToken.symbol}</span>
            </div>
            {isMONtoMETH && (
              <div className="flex items-center justify-between text-[#555]">
                <span>Rate</span>
                <span className="font-mono text-green-400">1 MON = {rate.toFixed(2)} mETH</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[#555]">
              <span>Gas fee</span>
              <span className="font-mono">~0.001 {fromChain.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-[#555]">
              <span>Settlement</span>
              <span className="font-mono text-green-400">{isCrossChain ? "~2-5 min" : "< 0.5s"}</span>
            </div>
          </div>
        )}

        {/* ── Status ───────────────────────────────────────────────── */}
        {status === "success" && txHash && (
          <div className="card flex items-center gap-3 text-green-400 text-sm">
            <CheckCircle size={16} />
            <div className="flex-1">
              <p className="font-medium">
                {swapResult
                  ? `${swapResult.from} ${swapResult.fromSym} → ${parseFloat(swapResult.to).toFixed(swapResult.toSym === "MON" ? 6 : 2)} ${swapResult.toSym} received!`
                  : "Swap successful!"}
              </p>
              <a
                href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-[#666] hover:text-white flex items-center gap-1 mt-0.5"
              >
                {txHash.slice(0, 16)}… <ExternalLink size={10} />
              </a>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="card flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle size={16} />
            <p className="text-xs break-all">{errMsg || "Transaction failed"}</p>
          </div>
        )}

        {/* ── Swap button ───────────────────────────────────────────── */}
        <button
          onClick={executeSwap}
          disabled={!isConnected || !amount || parseFloat(amount) <= 0 || status === "pending" || isConfirming}
          className={clsx(
            "w-full py-3.5 rounded-2xl font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2",
            isConnected && amount && parseFloat(amount) > 0
              ? "bg-white text-black hover:bg-gray-100 active:bg-gray-200"
              : "bg-[#111] text-[#444] cursor-not-allowed border border-[#1f1f1f]"
          )}
        >
          {status === "pending" || isConfirming ? (
            <><Loader2 size={16} className="animate-spin" />{isConfirming ? "Confirming…" : "Swapping…"}</>
          ) : !isConnected ? "Connect Wallet"
            : !amount        ? "Enter amount"
            : isMONtoMETH  ? `Swap ${amount} MON → ${parseFloat(estimate).toFixed(2)} mETH`
            : isMETHtoMON ? `Swap ${amount} mETH → ${parseFloat(estimate).toFixed(6)} MON`
            : `Swap ${fromToken.symbol} → ${toToken.symbol}`
          }
        </button>

        <p className="text-center text-[10px] font-mono text-[#333] pt-1">
          ⚡ Monad Testnet · Rate updates every 3s
        </p>
      </div>
    </div>
  );
}
