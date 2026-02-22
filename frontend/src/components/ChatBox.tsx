"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, parseEther } from "viem";
import { Send, Bot, User, Zap, TrendingUp, RefreshCw, BarChart2, ArrowRightLeft, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { CONTRACT_ADDRESSES, MOCK_TOKEN_ABI } from "@/lib/contracts";
import { monadTestnet } from "@/lib/wagmi-config";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SwapAction {
  action:          "swap";
  fromToken:       string;
  toToken:         string;
  amount:          string;
  estimatedOutput: string;
  message:         string;
}

interface Message {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  ts:          number;
  swapAction?: SwapAction;
  swapStatus?: "pending-confirm" | "signing" | "confirmed" | "failed";
  swapTxHash?: string;
  swapError?:  string;
}

const SUGGESTED = [
  { icon: TrendingUp,    text: "What's the best yield right now?" },
  { icon: ArrowRightLeft, text: "Swap 0.5 MON to mETH"           },
  { icon: RefreshCw,     text: "Rebalance for maximum APY"       },
  { icon: Zap,           text: "Swap 1000 mETH to MON"           },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg, onConfirmSwap }: { msg: Message; onConfirmSwap: (msgId: string) => void }) {
  const isBot = msg.role === "assistant";
  return (
    <div
      className={clsx(
        "flex gap-3 animate-fade-in",
        isBot ? "items-start" : "items-start flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isBot ? "bg-white" : "bg-[#222] border border-[#333]"
        )}
      >
        {isBot ? (
          <Bot size={14} className="text-black" />
        ) : (
          <User size={14} className="text-[#888]" />
        )}
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={clsx(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isBot
              ? "bg-[#111] border border-[#1f1f1f] text-white rounded-tl-sm"
              : "bg-white text-black rounded-tr-sm"
          )}
        >
          {/* Render markdown-lite: bold, code */}
          <MarkdownText text={msg.content} />

          {/* Swap confirmation card */}
          {msg.swapAction && (
            <SwapConfirmCard msg={msg} onConfirm={onConfirmSwap} />
          )}
        </div>
        <span
          className={clsx(
            "text-[10px] text-[#444] font-mono px-1",
            !isBot && "text-right"
          )}
        >
          {formatTime(msg.ts)}
        </span>
      </div>
    </div>
  );
}

// Minimal markdown renderer for bold and inline code
function MarkdownText({ text }: { text: string }) {
  // Split by lines first
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## "))  return <h3 key={i} className="font-semibold text-sm mt-2">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="font-medium text-xs mt-1">{line.slice(4)}</h4>;
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#555] mt-px">•</span>
              <InlineMarkdown text={line.slice(2)} />
            </div>
          );
        }
        if (line.match(/^\d+\. /)) {
          const num  = line.match(/^(\d+)\. /)?.[1];
          const rest = line.replace(/^\d+\. /, "");
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#555] text-xs mt-0.5 w-4 shrink-0">{num}.</span>
              <InlineMarkdown text={rest} />
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}><InlineMarkdown text={line} /></p>;
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Parse **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} className="bg-black/30 text-green-400 px-1 py-0.5 rounded text-[11px] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start animate-fade-in">
      <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0">
        <Bot size={14} className="text-black" />
      </div>
      <div className="bg-[#111] border border-[#1f1f1f] px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Swap Confirmation Card ────────────────────────────────────────────────

function SwapConfirmCard({
  msg,
  onConfirm,
}: {
  msg: Message;
  onConfirm: (msgId: string) => void;
}) {
  const swap = msg.swapAction!;
  const status = msg.swapStatus;

  return (
    <div className="mt-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ArrowRightLeft size={14} className="text-white" />
        <span className="text-xs font-mono text-[#888]">SWAP CONFIRMATION</span>
      </div>

      {/* Swap details */}
      <div className="flex items-center justify-between bg-[#111] rounded-xl px-4 py-3">
        <div className="text-center">
          <p className="text-lg font-semibold font-mono">{swap.amount}</p>
          <p className="text-xs text-[#888]">{swap.fromToken}</p>
        </div>
        <ArrowRightLeft size={16} className="text-[#555]" />
        <div className="text-center">
          <p className="text-lg font-semibold font-mono text-green-400">{swap.estimatedOutput}</p>
          <p className="text-xs text-[#888]">{swap.toToken}</p>
        </div>
      </div>

      {/* Rate info */}
      <div className="flex items-center justify-between text-xs text-[#555]">
        <span>Rate</span>
        <span className="font-mono text-[#888]">1 MON ≈ 1800 mETH</span>
      </div>
      <div className="flex items-center justify-between text-xs text-[#555]">
        <span>Network</span>
        <span className="font-mono text-[#888]">Monad Testnet</span>
      </div>
      <div className="flex items-center justify-between text-xs text-[#555]">
        <span>Gas</span>
        <span className="font-mono text-[#888]">~0.001 MON</span>
      </div>

      {/* Status / Action */}
      {status === "confirmed" && msg.swapTxHash && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 rounded-xl px-3 py-2">
          <CheckCircle size={14} />
          <span className="flex-1">Swap successful!</span>
          <a
            href={`https://testnet.monadexplorer.com/tx/${msg.swapTxHash}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-[#666] hover:text-white flex items-center gap-1"
          >
            {msg.swapTxHash.slice(0, 10)}… <ExternalLink size={10} />
          </a>
        </div>
      )}

      {status === "failed" && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          <span className="text-xs">{msg.swapError || "Transaction failed"}</span>
        </div>
      )}

      {status === "signing" && (
        <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Waiting for wallet signature…</span>
        </div>
      )}

      {status === "pending-confirm" && (
        <button
          onClick={() => onConfirm(msg.id)}
          className="w-full py-3 bg-white text-black font-semibold text-sm rounded-xl
                     hover:bg-gray-100 active:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ArrowRightLeft size={14} />
          Confirm & Sign Swap
        </button>
      )}
    </div>
  );
}

export default function ChatBox() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [messages, setMessages]   = useState<Message[]>([
    {
      id:      "welcome",
      role:    "assistant",
      content: "Hey! I'm **DeFi Copilot** — your AI yield optimizer on Monad.\n\nI can help you:\n- Find the best yield opportunities\n- Rebalance your portfolio across protocols\n- **Swap tokens** using plain English\n- Analyze your risk and performance\n\nTry saying: *\"Swap 0.5 MON to mETH\"*",
      ts:      Date.now(),
    },
  ]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Execute swap via wallet ──────────────────────────────────────────────
  const executeSwapFromChat = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg?.swapAction || !address) return;

      const swap = msg.swapAction;

      // Mark as signing
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, swapStatus: "signing" as const } : m))
      );

      try {
        let txHash: `0x${string}`;

        if (swap.fromToken === "MON" && swap.toToken === "mETH") {
          // MON → mETH: mint mETH (simulated swap)
          const outAmount = parseUnits(swap.estimatedOutput, 18);
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.meth as `0x${string}`,
            abi: MOCK_TOKEN_ABI,
            functionName: "mint",
            args: [address, outAmount],
            chainId: monadTestnet.id,
          });
        } else {
          // mETH → MON: burn mETH (transfer to dead address)
          const burnAmount = parseUnits(swap.amount, 18);
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.meth as `0x${string}`,
            abi: MOCK_TOKEN_ABI,
            functionName: "transfer",
            args: ["0x000000000000000000000000000000000000dEaD" as `0x${string}`, burnAmount],
            chainId: monadTestnet.id,
          });
        }

        // Success
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, swapStatus: "confirmed" as const, swapTxHash: txHash }
              : m
          )
        );
      } catch (err: any) {
        const errMsg =
          err?.shortMessage || err?.message || "Transaction rejected";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, swapStatus: "failed" as const, swapError: errMsg }
              : m
          )
        );
      }
    },
    [messages, address, writeContractAsync]
  );

  // ── Send message & handle SSE response ───────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id:      crypto.randomUUID(),
        role:    "user",
        content: text.trim(),
        ts:      Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      const history = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text.trim() },
      ];

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", ts: Date.now() },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            walletAddress: address,
          }),
        });

        if (!res.body) throw new Error("No response body");

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);

              // ── Swap action payload ──
              if (parsed.action) {
                const swapAction = parsed.action as SwapAction;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:    swapAction.message,
                          swapAction,
                          swapStatus: "pending-confirm" as const,
                        }
                      : m
                  )
                );
              }

              // ── Normal text chunk ──
              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.text }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, I encountered an error. Please check your API key and try again.",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, address]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 pb-4 h-[calc(100vh-4rem)]">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="py-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
        <span className="text-xs font-mono text-[#555]">MONAD TESTNET</span>
        {address && (
          <span className="text-xs font-mono text-[#444] ml-auto">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onConfirmSwap={executeSwapFromChat} />
        ))}
        {isLoading && messages[messages.length - 1]?.content === "" && (
          <TypingIndicator />
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested commands ───────────────────────────────────────── */}
      {messages.length <= 1 && (
        <div className="py-3 grid grid-cols-2 gap-2">
          {SUGGESTED.map((s) => (
            <button
              key={s.text}
              onClick={() => sendMessage(s.text)}
              className="flex items-center gap-2 bg-[#111] border border-[#1f1f1f] hover:border-[#333]
                         text-[#888] hover:text-white text-xs px-3 py-2.5 rounded-xl text-left
                         transition-all duration-150"
            >
              <s.icon size={13} className="shrink-0 text-[#555]" />
              {s.text}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ────────────────────────────────────────────────────── */}
      <div className="pt-3 border-t border-[#1f1f1f]">
        <div className="flex gap-3 items-end bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#333]
                        rounded-2xl px-4 py-3 transition-colors focus-within:border-[#444]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or describe a DeFi action…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-white placeholder-[#444] text-sm resize-none
                       outline-none min-h-[24px] max-h-32 leading-relaxed"
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shrink-0
                       hover:bg-gray-100 active:bg-gray-200 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} className="text-black" />
          </button>
        </div>
        <p className="text-[10px] text-[#333] text-center mt-2 font-mono">
          ENTER to send · SHIFT+ENTER for new line
        </p>
      </div>
    </div>
  );
}
