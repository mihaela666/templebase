"use client";

interface GameOverProps {
  score: number;
  bestScore: number;
  coins: number;
  isNewBest: boolean;
  onRestart: () => void;
  onMenu: () => void;
  onLeaderboard: () => void;
  walletConnected: boolean;
}

export default function GameOver({
  score,
  bestScore,
  coins,
  isNewBest,
  onRestart,
  onMenu,
  onLeaderboard,
  walletConnected,
}: GameOverProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="glass-card rounded-3xl p-6 max-w-[320px] w-full shadow-[0_8px_40px_rgba(0,0,0,0.3)] animate-bounce-in">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-black text-white mb-1">
            {isNewBest ? "New Record!" : "Game Over"}
          </h2>
          {isNewBest && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
              <span className="text-amber-400 text-xs font-bold">Personal Best!</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 glass-card rounded-2xl p-3 text-center">
            <div className="text-[9px] font-bold text-[#8b8fa3] uppercase tracking-wider mb-1">Score</div>
            <div className="text-3xl font-black text-white tabular-nums">{score}</div>
          </div>
          <div className="flex-1 glass-card rounded-2xl p-3 text-center">
            <div className="text-[9px] font-bold text-[#8b8fa3] uppercase tracking-wider mb-1">Best</div>
            <div className="text-3xl font-black text-amber-400 tabular-nums">{bestScore}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl px-4 py-2 mb-5 flex items-center justify-center gap-2">
          <span className="text-amber-400 text-sm">🪙</span>
          <span className="text-white font-bold text-sm">{coins} coins collected</span>
        </div>

        {score >= 100 && (
          <div className="flex justify-center mb-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
              score >= 1000
                ? "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-amber-500/30"
                : score >= 500
                ? "bg-gradient-to-br from-gray-300 to-gray-500 shadow-gray-400/30"
                : "bg-gradient-to-br from-amber-700 to-amber-900 shadow-amber-700/30"
            }`}>
              <span className="text-2xl">
                {score >= 1000 ? "🏆" : score >= 500 ? "🥈" : "🥉"}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRestart}
            className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-red-500 text-white font-bold text-sm rounded-xl
              shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35
              active:scale-[0.97] transition-all"
          >
            Run Again
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={onMenu}
              className="flex-1 py-3 glass-card text-white font-semibold text-sm rounded-xl
                hover:bg-white/12 active:scale-[0.97] transition-all"
            >
              Menu
            </button>
            <button
              onClick={onLeaderboard}
              className="flex-1 py-3 glass-card text-white font-semibold text-sm rounded-xl
                hover:bg-white/12 active:scale-[0.97] transition-all"
            >
              Rankings
            </button>
          </div>
        </div>

        {walletConnected && (
          <p className="text-[10px] text-[#6b7280] text-center mt-3">
            Score submitted to leaderboard
          </p>
        )}
      </div>
    </div>
  );
}
