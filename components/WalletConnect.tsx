"use client";

import { useAuth } from "@/hooks/useAuth";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const { ready, authenticated, address, login, logout } = useAuth();

  if (!ready) return null;

  if (authenticated && address) {
    return (
      <button
        onClick={() => logout()}
        className="flex items-center gap-2 px-3 py-1.5 glass-card
          text-white text-xs font-semibold rounded-full
          hover:bg-white/12 active:scale-95 transition-all
          shadow-[0_2px_12px_rgba(0,82,255,0.15)]"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-3 py-1.5 glass-card
        text-white text-xs font-bold rounded-full
        hover:bg-white/12 active:scale-95 transition-all
        shadow-[0_2px_12px_rgba(0,82,255,0.15)]"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
      </svg>
      Connect
    </button>
  );
}
