"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Send, Bot, User, Zap, TrendingUp, RefreshCw, BarChart2 } from "lucide-react";
import { clsx } from "clsx";

interface Message {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  ts:      number;
}

const SUGGESTED = [
  { icon: TrendingUp, text: "What's the best yield right now?" },
  { icon: BarChart2,  text: "Show my portfolio allocation"     },
  { icon: RefreshCw,  text: "Rebalance for maximum APY"        },
  { icon: Zap,        text: "Put 60% USDC in highest yield"    },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg }: { msg: Message }) {
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

export default function ChatBox() {
  const { address } = useAccount();
  const [messages, setMessages]   = useState<Message[]>([
    {
      id:      "welcome",
      role:    "assistant",
      content: "Hey! I'm **DeFi Copilot** — your AI yield optimizer on Monad.\n\nI can help you:\n- Find the best yield opportunities\n- Rebalance your portfolio across protocols\n- Execute DeFi actions in plain English\n- Analyze your risk and performance\n\nWhat would you like to do today?",
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
              const { text } = JSON.parse(data);
              if (text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + text }
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
          <MessageBubble key={msg.id} msg={msg} />
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
