"use client";

import { useState } from "react";
import TopNav from "@/components/TopNav";
import ChatBox from "@/components/ChatBox";
import PortfolioDashboard from "@/components/PortfolioDashboard";
import SwapPanel from "@/components/SwapPanel";
import VaultPanel from "@/components/VaultPanel";

export type Tab = "chat" | "dashboard" | "swap" | "vault";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* ── Fixed top navigation ─────────────────────────────────────── */}
      <TopNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col pt-16">
        {activeTab === "chat"      && <ChatBox />}
        {activeTab === "dashboard" && <PortfolioDashboard />}
        {activeTab === "swap"      && <SwapPanel />}
        {activeTab === "vault"     && <VaultPanel />}
      </main>
    </div>
  );
}
