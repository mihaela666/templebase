"use client";

import { useState, useEffect } from "react";
import { getBestScore } from "@/lib/game-engine";
import WalletConnect from "@/components/WalletConnect";

interface MenuProps {
  onPlay: () => void;
  onLeaderboard: () => void;
  onGm?: () => void;
  loading?: boolean;
  error?: string | null;
  walletConnected?: boolean;
  gmDone?: boolean;
}

function getTimeUntilReset(): string {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcS = now.getUTCSeconds();
  const totalSecsNow = utcH * 3600 + utcM * 60 + utcS;
  const resetAt = 1 * 3600;
  let diff = resetAt - totalSecsNow;
  if (diff <= 0) diff += 86400;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Menu({ onPlay, onLeaderboard, onGm, loading, error, walletConnected, gmDone }: MenuProps) {
  const best = getBestScore();
  const [countdown, setCountdown] = useState(getTimeUntilReset());

  useEffect(() => {
    if (!gmDone) return;
    const interval = setInterval(() => {
      setCountdown(getTimeUntilReset());
    }, 1000);
    return () => clearInterval(interval);
  }, [gmDone]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 animate-fade-in max-w-[340px] w-full">
      <div className="w-full flex justify-end -mb-2">
        <WalletConnect />
      </div>

      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 flex items-center justify-center shadow-xl shadow-orange-500/30 animate-bounce-in">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="10" y="18" width="28" height="24" rx="2" fill="#8B6914" opacity="0.9"/>
            <polygon points="24,4 8,18 40,18" fill="#D4A017"/>
            <polygon points="24,4 8,18 40,18" fill="url(#templeGrad)" opacity="0.5"/>
            <rect x="14" y="20" width="4" height="20" rx="1" fill="#F5DEB3" opacity="0.8"/>
            <rect x="22" y="20" width="4" height="20" rx="1" fill="#F5DEB3" opacity="0.8"/>
            <rect x="30" y="20" width="4" height="20" rx="1" fill="#F5DEB3" opacity="0.8"/>
            <rect x="8" y="40" width="32" height="4" rx="1" fill="#6B4F1D"/>
            <rect x="6" y="16" width="36" height="3" rx="1" fill="#D4A017"/>
            <circle cx="24" cy="12" r="2" fill="#FFD700"/>
            <defs>
              <linearGradient id="templeGrad" x1="24" y1="4" x2="24" y2="18">
                <stop offset="0%" stopColor="#FFD700"/>
                <stop offset="100%" stopColor="#8B6914"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {best > 0 && (
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md shadow-amber-500/30">
            Best: {best}
          </div>
        )}
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-black text-white tracking-tight">
          Temple Base
        </h1>
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="text-[#8b8fa3] text-xs font-medium">on</span>
            <div className="w-4 h-4 rounded bg-base-blue flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 111 111" fill="none">
                <path
                  d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xs">Base</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-center font-medium">
          {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-3">
        {gmDone ? (
          <div className="w-full py-4 bg-gradient-to-r from-amber-500/30 via-yellow-400/30 to-orange-400/30 border border-amber-500/30
            text-amber-300 font-black text-lg rounded-2xl flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              GM done!
            </div>
            <span className="text-amber-400/60 text-xs font-medium tabular-nums">
              Next in {countdown}
            </span>
          </div>
        ) : (
          <button
            onClick={onGm}
            disabled={loading || !walletConnected}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-400 text-[#1a1a2e] font-black text-xl rounded-2xl
              shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40
              active:scale-[0.97] transition-all flex items-center justify-center gap-3
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="6" fill="white" />
                <circle cx="14" cy="14" r="4.5" fill="#fffbeb" />
                <line x1="14" y1="1.5" x2="14" y2="5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="23" x2="14" y2="26.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="1.5" y1="14" x2="5" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="23" y1="14" x2="26.5" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="5.2" y1="5.2" x2="7.7" y2="7.7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="20.3" y1="20.3" x2="22.8" y2="22.8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="5.2" y1="22.8" x2="7.7" y2="20.3" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="20.3" y1="7.7" x2="22.8" y2="5.2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
            GM
          </button>
        )}

        <button
          onClick={onPlay}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-500 text-white font-bold text-base rounded-2xl
            shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40
            active:scale-[0.97] transition-all animate-pulse-glow
            disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            "Run!"
          )}
        </button>

        <button
          onClick={onLeaderboard}
          className="w-full py-3.5 glass-card text-white font-bold text-sm rounded-2xl
            shadow-sm hover:bg-white/12 active:scale-[0.97] transition-all"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Leaderboard
          </span>
        </button>
      </div>

      <div className="glass-card rounded-2xl p-4 w-full">
        <p className="text-[#8b8fa3] text-xs font-semibold uppercase tracking-wider mb-2">How to Play</p>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1.5 text-center flex-1">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <span className="text-lg">👈👉</span>
            </div>
            <p className="text-white/60 text-[10px] leading-tight">Swipe to dodge</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center flex-1">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <span className="text-lg">👆</span>
            </div>
            <p className="text-white/60 text-[10px] leading-tight">Swipe up to jump</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center flex-1">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <span className="text-lg">🪙</span>
            </div>
            <p className="text-white/60 text-[10px] leading-tight">Collect coins</p>
          </div>
        </div>
      </div>
    </div>
  );
}
