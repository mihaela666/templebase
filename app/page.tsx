"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import sdk from "@farcaster/miniapp-sdk";
import BaseAppGate from "@/components/BaseAppGate";
import Menu from "@/components/Menu";
import GameOver from "@/components/GameOver";
import NftNotification from "@/components/NftNotification";
import { useAuth } from "@/hooks/useAuth";
import { useContract } from "@/hooks/useContract";

const TempleGame = dynamic(() => import("@/components/TempleGame"), { ssr: false });
const Leaderboard = dynamic(() => import("@/components/Leaderboard"), { ssr: false });

type Screen = "menu" | "game" | "gameover" | "leaderboard";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [lastScore, setLastScore] = useState(0);
  const [lastBest, setLastBest] = useState(0);
  const [lastCoins, setLastCoins] = useState(0);
  const [nftTokenId, setNftTokenId] = useState<string | null>(null);
  const [gmDone, setGmDone] = useState(false);
  const { address } = useAuth();
  const { startRun, gm, canGm, loading, error } = useContract();

  useEffect(() => {
    if (address) {
      canGm(address).then((can) => setGmDone(!can));
    }
  }, [address, canGm]);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const handlePlay = useCallback(async () => {
    setScreen("game");
    if (address) {
      const result = await startRun();
      if (result.nftMinted && result.tokenId) {
        setNftTokenId(result.tokenId);
      }
    }
  }, [address, startRun]);

  const handleGm = useCallback(async () => {
    if (!address) return;
    const success = await gm();
    if (success) setGmDone(true);
  }, [address, gm]);

  const handleGameOver = useCallback((score: number, bestScore: number, coins: number) => {
    setLastScore(score);
    setLastBest(bestScore);
    setLastCoins(coins);
    setScreen("gameover");
  }, []);

  const handleRestart = useCallback(async () => {
    setScreen("game");
    if (address) {
      const result = await startRun();
      if (result.nftMinted && result.tokenId) {
        setNftTokenId(result.tokenId);
      }
    }
  }, [address, startRun]);

  return (
    <BaseAppGate>
      <div className="animated-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div className="orb orb-5" />
      </div>

      <main className="relative z-10 flex flex-col h-[100dvh] overflow-hidden">
        <div className={`flex-1 flex min-h-0 pb-4 overflow-y-auto
          ${screen === "leaderboard" ? "items-start" : "items-center justify-center"}`}
        >
          {screen === "menu" && (
            <Menu
              onPlay={handlePlay}
              onLeaderboard={() => setScreen("leaderboard")}
              onGm={handleGm}
              loading={loading}
              error={error}
              walletConnected={!!address}
              gmDone={gmDone}
            />
          )}

          {screen === "game" && (
            <TempleGame
              onBack={() => setScreen("menu")}
              onGameOver={handleGameOver}
            />
          )}

          {screen === "leaderboard" && (
            <Leaderboard onBack={() => setScreen("menu")} />
          )}
        </div>
      </main>

      {screen === "gameover" && (
        <GameOver
          score={lastScore}
          bestScore={lastBest}
          coins={lastCoins}
          isNewBest={lastScore >= lastBest && lastScore > 0}
          onRestart={handleRestart}
          onMenu={() => setScreen("menu")}
          onLeaderboard={() => setScreen("leaderboard")}
          walletConnected={!!address}
        />
      )}

      {nftTokenId && (
        <NftNotification
          tokenId={nftTokenId}
          onClose={() => setNftTokenId(null)}
        />
      )}
    </BaseAppGate>
  );
}
