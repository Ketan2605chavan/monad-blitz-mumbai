"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { type Tab } from "@/app/page";
import { Zap } from "lucide-react";
import { clsx } from "clsx";

interface TopNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "chat",      label: "Chat"      },
  { id: "dashboard", label: "Dashboard" },
  { id: "swap",      label: "Swap"      },
  { id: "vault",     label: "Vault"     },
];

export default function TopNav({ activeTab, onTabChange }: TopNavProps) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-black border-b border-[#1f1f1f] flex items-center px-4 md:px-6 gap-4">
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mr-4 shrink-0">
        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-black" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-white tracking-tight text-sm hidden sm:block">
          DeFi Copilot
        </span>
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap",
              activeTab === tab.id
                ? "bg-white text-black"
                : "text-[#888] hover:text-white hover:bg-[#111]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Live indicator ───────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-[#555] shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-slow" />
        <span className="font-mono">Monad 0.4s</span>
      </div>

      {/* ── Wallet ───────────────────────────────────────────────────── */}
      <div className="shrink-0 ml-2">
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="avatar"
        />
      </div>
    </nav>
  );
}
