import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "DeFi Copilot — AI Yield Optimizer on Monad",
  description:
    "AI-powered autonomous yield optimizer and natural language DeFi agent built on Monad. Sub-second execution, cross-chain swaps, and intelligent rebalancing.",
  keywords: ["DeFi", "Monad", "AI", "Yield", "Optimizer", "Blockchain"],
  openGraph: {
    title: "DeFi Copilot",
    description: "AI Yield Optimizer on Monad",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-primary antialiased">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
