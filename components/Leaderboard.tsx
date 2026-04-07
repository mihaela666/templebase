"use client";

import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { useAuth } from "@/hooks/useAuth";

interface LeaderboardProps {
  onBack: () => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getMedalEmoji(rank: number): string {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return "";
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { address } = useAuth();

  useEffect(() => {
    getLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[380px] mx-auto px-4 pt-2 pb-6 animate-fade-in">
      <div className="flex items-center justify-between w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl
            text-white text-sm font-semibold
            hover:bg-white/12 active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="text-xl font-black text-white">Leaderboard</h2>

        <div className="w-[72px]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 w-full text-center">
          <p className="text-[#8b8fa3] text-sm">No scores yet</p>
          <p className="text-[#6b7280] text-xs mt-1">Be the first to run!</p>
        </div>
      ) : (
        <div className="w-full space-y-2">
          {entries.map((entry, i) => {
            const isMe = address && entry.address.toLowerCase() === address.toLowerCase();
            const medal = getMedalEmoji(i);

            return (
              <div
                key={`${entry.address}-${i}`}
                className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                  isMe ? "border-amber-500/40 bg-amber-500/10" : ""
                } ${i < 3 ? "shadow-md" : ""}`}
              >
                <div className="w-8 text-center shrink-0">
                  {medal ? (
                    <span className="text-lg">{medal}</span>
                  ) : (
                    <span className="text-[#8b8fa3] text-sm font-bold">{i + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? "text-amber-400" : "text-white"}`}>
                    {isMe ? "You" : truncateAddress(entry.address)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-lg font-black tabular-nums ${
                    i === 0 ? "text-amber-400" : "text-white"
                  }`}>
                    {entry.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
