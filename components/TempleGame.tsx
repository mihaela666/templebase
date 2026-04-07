"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createInitialState,
  startRun,
  moveLeft,
  moveRight,
  jump,
  slide,
  update,
  GAME_CONSTANTS,
  type GameState,
  type PowerUpType,
} from "@/lib/game-engine";
import { GameRenderer3D } from "@/lib/game-renderer-3d";
import {
  playCoin,
  playJump,
  playSlide,
  playHit,
  playDie,
  isMuted,
  setMuted,
  initMuted,
} from "@/lib/sounds";
import { submitScore } from "@/lib/leaderboard";

interface TempleGameProps {
  onBack: () => void;
  onGameOver: (score: number, bestScore: number, coins: number) => void;
}

const SWIPE_THRESHOLD = 30;

const PU_TEXT: Record<string, string> = {
  speed: "SPEED BOOST!",
  shield: "SHIELD!",
  life: "+1 LIFE!",
  magnet: "MAGNET!",
};
const PU_COLOR: Record<string, string> = {
  speed: "#FF3300",
  shield: "#0088FF",
  life: "#00FF44",
  magnet: "#FFDD00",
};
const PU_ICON: Record<string, string> = {
  speed: "\u26A1",
  shield: "\uD83D\uDEE1\uFE0F",
  life: "\u2764\uFE0F",
  magnet: "\uD83E\uDDF2",
};

export default function TempleGame({ onBack, onGameOver }: TempleGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer3D | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const rafRef = useRef<number>(0);
  const [soundOff, setSoundOff] = useState(false);
  const [phase, setPhase] = useState<string>("idle");
  /** Synced from rAF game loop so HUD re-renders every frame (refs alone do not trigger React updates). */
  const [hudScore, setHudScore] = useState(0);
  const [hudCoins, setHudCoins] = useState(0);
  const [hudDistance, setHudDistance] = useState(0);
  const livesElRef = useRef<HTMLDivElement>(null);
  const puBarWrapRef = useRef<HTMLDivElement>(null);
  const puBarRef = useRef<HTMLDivElement>(null);
  const puIconElRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const speedOverRef = useRef<HTMLDivElement>(null);
  const magnetOverRef = useRef<HTMLDivElement>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestHudRef = useRef<HTMLDivElement>(null);
  const coinPlusRef = useRef<HTMLDivElement>(null);
  const coinPlusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionBlurRef = useRef<HTMLDivElement>(null);
  const speedLinesRef = useRef<HTMLDivElement>(null);
  const { address } = useAuth();
  const addressRef = useRef(address);
  addressRef.current = address;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    initMuted();
    setSoundOff(isMuted());
  }, []);

  const showPopup = useCallback((type: PowerUpType) => {
    const el = popupRef.current;
    if (!el) return;
    el.textContent = PU_TEXT[type] || "POWER UP!";
    el.style.color = PU_COLOR[type] || "#fff";
    el.style.opacity = "1";
    el.style.transform = "scale(1.3)";
    el.style.textShadow = `0 0 20px ${PU_COLOR[type] || "#fff"}, 0 2px 8px rgba(0,0,0,0.5)`;
    setTimeout(() => { if (el) el.style.transform = "scale(1)"; }, 150);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => { if (el) el.style.opacity = "0"; }, 1200);
  }, []);

  const showFlash = useCallback((type: PowerUpType) => {
    const el = flashRef.current;
    if (!el) return;
    const colors: Record<string, string> = {
      speed: "rgba(255,30,0,0.25)", shield: "rgba(0,136,255,0.25)",
      life: "rgba(0,255,68,0.25)", magnet: "rgba(255,220,0,0.25)",
    };
    el.style.backgroundColor = colors[type] || "rgba(255,255,255,0.25)";
    el.style.opacity = "1";
    setTimeout(() => { if (el) el.style.opacity = "0"; }, 250);
  }, []);

  const handleInput = useCallback((action: "left" | "right" | "jump" | "slide" | "tap") => {
    const state = stateRef.current;
    if (state.phase === "dead") {
      onGameOverRef.current(state.score, state.bestScore, state.coins);
      return;
    }
    if (state.phase === "dying") return;
    if (state.phase === "idle") {
      stateRef.current = startRun(state);
      setPhase("running");
      return;
    }
    switch (action) {
      case "left": stateRef.current = moveLeft(state); break;
      case "right": stateRef.current = moveRight(state); break;
      case "jump": stateRef.current = jump(state); playJump(); break;
      case "slide": stateRef.current = slide(state); playSlide(); break;
      case "tap": stateRef.current = jump(state); playJump(); break;
    }
  }, []);

  const showCoinPlus = useCallback(() => {
    const el = coinPlusRef.current;
    if (!el) return;
    el.textContent = "+10";
    el.style.opacity = "1";
    el.style.transform = "translate(-50%, 0) scale(1.15)";
    if (coinPlusTimerRef.current) clearTimeout(coinPlusTimerRef.current);
    coinPlusTimerRef.current = setTimeout(() => {
      if (el) {
        el.style.opacity = "0";
        el.style.transform = "translate(-50%, -28px) scale(0.9)";
      }
    }, 650);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const renderer3d = new GameRenderer3D(viewport);
    rendererRef.current = renderer3d;

    let dead = false;
    let lastT = performance.now();

    function gameLoop() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const current = stateRef.current;
      const result = update(current, dt);
      stateRef.current = result.state;
      const s = result.state;

      if (result.coinCollected) {
        playCoin();
        showCoinPlus();
      }
      if (result.hurtThisFrame) {
        const f = flashRef.current;
        if (f) {
          f.style.backgroundColor = "rgba(220,40,40,0.45)";
          f.style.opacity = "1";
          setTimeout(() => { if (f) f.style.opacity = "0"; }, 120);
        }
      }
      if (result.died) {
        playHit();
        const f = flashRef.current;
        if (f) {
          f.style.backgroundColor = "rgba(180,20,20,0.65)";
          f.style.opacity = "1";
          setTimeout(() => { if (f) f.style.opacity = "0"; }, 280);
        }
        setTimeout(playDie, 200);
        if (addressRef.current) {
          submitScore(addressRef.current, s.score);
        }
      }

      if (s.phase === "dead" && !dead) {
        dead = true;
        setPhase("dead");
        setHudScore(s.score);
        setHudCoins(s.coins);
        setHudDistance(Math.floor(s.distance));
        setTimeout(() => {
          const st = stateRef.current;
          onGameOverRef.current(st.score, st.bestScore, st.coins);
        }, 800);
      }

      // React HUD: state updates every frame while playing (rAF does not re-render by itself)
      if (s.phase === "idle") {
        setHudScore(0);
        setHudCoins(0);
        setHudDistance(0);
      } else {
        setHudScore(s.score);
        setHudCoins(s.coins);
        setHudDistance(Math.floor(s.distance));
      }

      if (bestHudRef.current) bestHudRef.current.textContent = String(s.bestScore);

      const vp = viewportRef.current;
      if (vp) vp.style.transform = "translate(0,0)";

      const effSp = s.speed * (s.speedBoostActive ? 1.5 : 1);
      const spdN = Math.min(1, effSp / GAME_CONSTANTS.MAX_RUN_SPEED);
      if (motionBlurRef.current) {
        motionBlurRef.current.style.opacity = s.phase === "running" ? String(Math.min(0.52, Math.max(0, spdN) * 0.62)) : "0";
      }
      if (speedLinesRef.current) {
        speedLinesRef.current.style.opacity = s.phase === "running" && spdN > 0.28 ? String(Math.min(0.92, (spdN - 0.28) * 1.35)) : "0";
      }

      // Lives
      if (livesElRef.current) {
        let html = "";
        for (let i = 0; i < 3; i++) {
          html += i < s.lives
            ? '<span style="font-size:14px">❤️</span>'
            : '<span style="font-size:14px;opacity:0.2">🖤</span>';
        }
        livesElRef.current.innerHTML = html;
      }

      // Power-up collected
      if (result.powerUpCollected) {
        showPopup(result.powerUpCollected);
        showFlash(result.powerUpCollected);
      }

      // Active power-up bar
      if (puBarWrapRef.current && puBarRef.current) {
        let timer = 0, duration = 1, icon = "", color = "";
        if (s.shieldActive && s.shieldTimer > timer) { timer = s.shieldTimer; duration = GAME_CONSTANTS.SHIELD_DURATION; icon = PU_ICON.shield; color = PU_COLOR.shield; }
        if (s.speedBoostActive && s.speedBoostTimer > timer) { timer = s.speedBoostTimer; duration = GAME_CONSTANTS.SPEED_BOOST_DURATION; icon = PU_ICON.speed; color = PU_COLOR.speed; }
        if (s.magnetActive && s.magnetTimer > timer) { timer = s.magnetTimer; duration = GAME_CONSTANTS.MAGNET_DURATION; icon = PU_ICON.magnet; color = PU_COLOR.magnet; }

        if (timer > 0) {
          puBarWrapRef.current.style.display = "flex";
          const pct = (timer / duration) * 100;
          puBarRef.current.style.width = `${pct}%`;
          puBarRef.current.style.backgroundColor = color;
          if (puIconElRef.current) puIconElRef.current.textContent = icon;
          puBarRef.current.style.opacity = timer < 120 && Math.sin(s.frame * 0.3) > 0 ? "0.4" : "1";
        } else {
          puBarWrapRef.current.style.display = "none";
        }
      }

      // Edge overlays
      if (speedOverRef.current) speedOverRef.current.style.display = s.speedBoostActive ? "block" : "none";
      if (magnetOverRef.current) magnetOverRef.current.style.display = s.magnetActive ? "block" : "none";

      renderer3d.update(stateRef.current, dt);
      rafRef.current = requestAnimationFrame(gameLoop);
    }

    rafRef.current = requestAnimationFrame(gameLoop);

    const handleResize = () => renderer3d.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
      renderer3d.dispose();
    };
  }, [showPopup, showFlash, showCoinPlus]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onBackRef.current(); return; }
      if (e.key === "p" || e.key === "P") { if (rendererRef.current) rendererRef.current.showPerf = !rendererRef.current.showPerf; return; }
      if (e.key === "b" || e.key === "B") {
        const st = stateRef.current;
        stateRef.current = { ...st, debugHitboxes: !st.debugHitboxes };
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); handleInput("right"); }
      else if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); handleInput("left"); }
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") { e.preventDefault(); handleInput("jump"); }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); handleInput("slide"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const opts = { passive: false } as AddEventListenerOptions;
    function preventScroll(e: TouchEvent) { e.preventDefault(); }
    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const start = touchStartRef.current;
      if (!start) { handleInput("tap"); return; }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      const dt = Date.now() - start.time;
      touchStartRef.current = null;
      if (dt > 500 || (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD)) { handleInput("tap"); return; }
      if (Math.abs(dx) > Math.abs(dy)) handleInput(dx > 0 ? "left" : "right");
      else handleInput(dy < 0 ? "jump" : "slide");
    }
    el.addEventListener("touchmove", preventScroll, opts);
    el.addEventListener("touchstart", handleTouchStart, opts);
    el.addEventListener("touchend", handleTouchEnd, opts);
    return () => {
      el.removeEventListener("touchmove", preventScroll);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleInput]);

  const toggleMute = useCallback(() => {
    setSoundOff((prev) => { const next = !prev; setMuted(next); return next; });
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState();
    setPhase("idle");
    setHudScore(0);
    setHudCoins(0);
    setHudDistance(0);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-fade-in pt-2">
      <div className="flex items-center justify-between w-full max-w-[400px] mx-auto px-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-white text-sm font-semibold hover:bg-white/12 active:scale-95 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Menu
        </button>
        <div className="flex items-center gap-3">
          <div className="glass-card rounded-xl px-3 py-1.5 text-center">
            <div className="text-[9px] font-bold text-[#8b8fa3] uppercase tracking-wider">Best</div>
            <div className="text-white font-black text-sm tabular-nums">{stateRef.current.bestScore}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={toggleMute} className="p-2 glass-card text-white rounded-xl hover:bg-white/12 active:scale-95 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
            {soundOff ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            )}
          </button>
          <button onClick={handleRestart} className="p-2 glass-card text-white rounded-xl hover:bg-white/12 active:scale-95 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.98 14.153v4.992" /></svg>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative touch-none select-none cursor-pointer rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.55)] border border-amber-900/30"
        style={{ width: "min(calc(100vw - 32px), 400px)", height: "calc(min(calc(100vw - 32px), 400px) * 1.75)" }}
        onClick={() => handleInput("tap")}
      >
        <div ref={viewportRef} className="absolute inset-0 z-0 bg-[#0a0e0c]" />
        <div
          ref={motionBlurRef}
          className="absolute inset-0 z-[2] pointer-events-none bg-stone-900/20 mix-blend-hard-light"
          style={{ opacity: 0, transition: "opacity 0.2s" }}
        />
        <div
          ref={speedLinesRef}
          className="absolute inset-0 z-[3] pointer-events-none opacity-0 transition-opacity duration-200"
          style={{
            background: "repeating-linear-gradient(105deg, transparent 0px, transparent 8px, rgba(255,255,255,0.06) 9px, transparent 14px)",
            maskImage: "linear-gradient(90deg, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        />
        {phase !== "dead" && stateRef.current.phase === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center animate-bounce-in bg-black/30 backdrop-blur-sm rounded-2xl px-8 py-4">
              <p className="text-white text-xl font-bold drop-shadow-lg mb-1">Tap to Run!</p>
              <p className="text-white/70 text-sm">Swipe to dodge, jump &amp; slide</p>
            </div>
          </div>
        )}

        {/* HUD uses React state synced every frame from the rAF loop */}
        <>
          <div
            className={`absolute top-2 left-0 right-0 z-10 pointer-events-none flex flex-col items-center gap-1 px-2 transition-opacity duration-150 ${phase === "idle" ? "opacity-0" : "opacity-100"}`}
          >
              <div className="bg-black/55 backdrop-blur-md rounded-2xl px-6 py-2 min-w-[200px] text-center border border-white/10 shadow-lg">
                <div className="text-[9px] font-bold text-amber-200/80 uppercase tracking-[0.2em]">Score</div>
                <div className="text-amber-300 font-black text-3xl tabular-nums leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{hudScore}</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-[360px]">
                <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 border border-white/10">
                  <span className="text-amber-400 text-base">{"\uD83E\uDE99"}</span>
                  <span className="text-white font-bold text-base tabular-nums">{hudCoins}</span>
                </div>
                <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 flex flex-col items-center leading-tight">
                  <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider">Distance</span>
                  <span className="text-emerald-200/90 font-bold text-sm tabular-nums">{hudDistance}m</span>
                </div>
                <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10">
                  <span className="text-[10px] text-white/50 font-bold uppercase mr-1">Best</span>
                  <span ref={bestHudRef} className="text-white font-black text-sm tabular-nums">0</span>
                </div>
                <div ref={livesElRef} className="bg-black/50 backdrop-blur-md rounded-xl px-2 py-1 flex gap-0.5 border border-white/10" />
              </div>
            </div>

          <div
            ref={coinPlusRef}
            className="absolute left-1/2 bottom-[38%] z-[21] pointer-events-none text-amber-300 font-black text-2xl tabular-nums opacity-0 transition-all duration-300"
            style={{ textShadow: "0 0 20px rgba(251,191,36,0.9), 0 2px 4px #000" }}
          />

          {/* Active power-up bar */}
          <div
            ref={puBarWrapRef}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 items-center gap-2 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 pointer-events-none"
            style={{ display: "none" }}
          >
            <span ref={puIconElRef} className="text-lg" />
            <div className="w-20 h-2.5 bg-white/15 rounded-full overflow-hidden">
              <div ref={puBarRef} className="h-full rounded-full transition-[width] duration-100" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Speed vignette */}
          <div
            ref={speedOverRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ display: "none", background: "radial-gradient(ellipse at center, transparent 50%, rgba(255,30,0,0.18) 100%)" }}
          />
          {/* Magnet vignette */}
          <div
            ref={magnetOverRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ display: "none", background: "radial-gradient(ellipse at center, transparent 50%, rgba(255,220,0,0.14) 100%)" }}
          />
        </>

        {/* Screen flash */}
        <div
          ref={flashRef}
          className="absolute inset-0 pointer-events-none z-20"
          style={{ opacity: 0, transition: "opacity 0.25s ease-out" }}
        />

        {/* Popup text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            ref={popupRef}
            className="text-3xl font-black"
            style={{ opacity: 0, transition: "opacity 0.3s, transform 0.15s", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
          />
        </div>
      </div>

      <p className="text-[#6b7280] text-xs text-center max-w-[280px]">
        {address ? "Your score will be saved to the leaderboard" : "Log in to save scores to leaderboard"}
      </p>
    </div>
  );
}
