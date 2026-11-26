"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { applyInput, createGame, step, tileAt } from "@/game/engine";
import { getCourse } from "@/game/courses";
import { POWERUP_TICKS, TICK_MS, Tile, type DeathReason, type Dir, type GameState, type InputEvent, type PowerUpKind, type SpeedSetting } from "@/game/types";
import { useT } from "@/i18n/I18nProvider";
import { NeonButton, NeonLink } from "@/components/ui/NeonButton";
import { IconApple, IconBolt } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { buildBoard, computeView, drawFrame, drawMiniMap, interpolatedSnake, PICKUP_STYLE, type View } from "./renderer";
import { sound } from "./sound";
import { TouchPad } from "./TouchPad";
import { formatTime, readBest, readPref, writeBest, writePref } from "./useBestTime";

type Phase = "ready" | "countdown" | "playing" | "paused" | "over";

export interface RunResult {
  courseId: string;
  speed: SpeedSetting;
  status: "dead" | "complete";
  ticks: number;
  timeMs: number;
  applesCollected: number;
  deathReason: DeathReason | null;
  /** submit this (not the time) to the server for verification */
  inputs: InputEvent[];
}

interface Props {
  courseId: string;
  initialSpeed?: SpeedSetting;
  /** competitions lock the speed so every participant has identical rules */
  lockSpeed?: boolean;
  /** called when a run ends (Phase 4 uses this to submit the input log) */
  onRunEnd?: (r: RunResult) => void;
  exitHref?: string;
}

interface Hud {
  apples: number;
  moves: number;
  terrain: "normal" | "water" | "boost";
  boostLeft: number;
  magnetLeft: number;
  energyLeft: number;
  shield: boolean;
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R",
  w: "U", s: "D", a: "L", d: "R", W: "U", S: "D", A: "L", D: "R",
};

function snapshot(s: GameState): Hud {
  return {
    apples: s.applesCollected,
    moves: s.moves,
    terrain: s.tick < s.effects.boostUntil ? "boost" : "normal",
    boostLeft: Math.max(0, s.effects.boostUntil - s.tick),
    magnetLeft: Math.max(0, s.effects.magnetUntil - s.tick),
    energyLeft: Math.max(0, s.effects.energyUntil - s.tick),
    shield: s.effects.shieldCharges > 0,
  };
}

export function GameClient({ courseId, initialSpeed, lockSpeed = false, onRunEnd, exitHref = "/arena" }: Props) {
  const { t } = useT();
  const course = useMemo(() => getCourse(courseId), [courseId]);

  const [speed, setSpeed] = useState<SpeedSetting>(initialSpeed ?? course?.defaultSpeed ?? "normal");
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<Hud>({ apples: 0, moves: 0, terrain: "normal", boostLeft: 0, magnetLeft: 0, energyLeft: 0, shield: false });
  const [result, setResult] = useState<(RunResult & { newBest: boolean; best: number | null }) | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const boardRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<View | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const accRef = useRef(0);
  const lastTsRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const hudTickRef = useRef(0);
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  /** QA-3: the single 3-2-1 timer; only one can run at a time. */
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** QA-2: which phase the current pause interrupted. Resume relies on this alone. */
  const pausedFromRef = useRef<"countdown" | "playing" | null>(null);
  /** QA-4: window-focus guard for pointer clicks on the pause controls. */
  const focusGuardRef = useRef<{ active: boolean; until: number }>({ active: false, until: 0 });
  const pressInGuardRef = useRef(false);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Stop the countdown timer when the player leaves the page.
  useEffect(() => stopCountdown, [stopCountdown]);

  // Preferences
  useEffect(() => {
    const sfx = readPref("sfx", true);
    const music = readPref("music", false);
    setSfxOn(sfx);
    setMusicOn(music);
    sound.sfxEnabled = sfx;
    return () => sound.setMusic(false);
  }, []);

  // Fresh state (shown behind the ready screen)
  const resetState = useCallback(() => {
    if (!course) return;
    stateRef.current = createGame(course, speed);
    accRef.current = 0;
    setHud(snapshot(stateRef.current));
    if (timerRef.current) timerRef.current.textContent = formatTime(0);
  }, [course, speed]);

  useEffect(() => {
    resetState();
  }, [resetState]);

  // Board cache + canvas sizing
  useEffect(() => {
    if (!course) return;
    boardRef.current = buildBoard(course);
    const canvas = canvasRef.current;
    const box = containerRef.current;
    if (!canvas || !box) return;
    const ro = new ResizeObserver(() => {
      const r = { width: box.clientWidth, height: box.clientHeight };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: r.width, h: r.height };
      viewRef.current = null;
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [course]);

  const endRun = useCallback(
    (s: GameState) => {
      if (!course) return;
      const timeMs = (s.finishTick ?? s.tick) * TICK_MS;
      const run: RunResult = {
        courseId: course.id,
        speed: s.speed,
        status: s.status === "complete" ? "complete" : "dead",
        ticks: s.tick,
        timeMs,
        applesCollected: s.applesCollected,
        deathReason: s.deathReason,
        inputs: s.inputs.slice(),
      };
      let best = readBest(course.id, s.speed);
      let newBest = false;
      if (run.status === "complete" && (best === null || timeMs < best)) {
        writeBest(course.id, s.speed, timeMs);
        newBest = best !== null;
        best = timeMs;
      }
      setResult({ ...run, newBest, best });
      setHud(snapshot(s));
      setPhaseBoth("over");
      onRunEndRef.current?.(run);
    },
    [course, setPhaseBoth],
  );

  // Main loop: fixed-step simulation, render every frame
  useEffect(() => {
    if (!course) return;
    let raf = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const s = stateRef.current;
      const canvas = canvasRef.current;
      const board = boardRef.current;
      if (!s || !canvas || !board) return;

      const dt = lastTsRef.current ? ts - lastTsRef.current : 0;
      lastTsRef.current = ts;

      if (phaseRef.current === "playing") {
        accRef.current += Math.min(dt, 250);
        let steps = 0;
        let hudDirty = false;
        while (accRef.current >= TICK_MS && steps < 12 && s.status === "running") {
          step(s, course);
          accRef.current -= TICK_MS;
          steps++;
          for (const ev of s.events) {
            if (ev.type === "apple") { sound.apple(); hudDirty = true; }
            else if (ev.type === "pickup") { sound.pickup(); hudDirty = true; }
            else if (ev.type === "shieldUsed") { sound.shield(); hudDirty = true; }
            else if (ev.type === "tunnel") sound.tunnel();
            else if (ev.type === "dead") sound.crash();
            else if (ev.type === "complete") sound.win();
            else if (ev.type === "move") hudDirty = true;
          }
        }
        if (timerRef.current) timerRef.current.textContent = formatTime((s.finishTick ?? s.tick) * TICK_MS);
        hudTickRef.current += dt;
        if (hudDirty || hudTickRef.current > 150) {
          hudTickRef.current = 0;
          const snap = snapshot(s);
          if (tileAt(course, s.snake[0].x, s.snake[0].y) === Tile.Water && s.tick >= s.effects.energyUntil && snap.terrain !== "boost") snap.terrain = "water";
          setHud(snap);
        }
        if (s.status !== "running") endRun(s);
      }

      const ctx = canvas.getContext("2d");
      const { w, h } = sizeRef.current;
      if (ctx && w && h) {
        const head = interpolatedSnake(s)[0];
        viewRef.current = computeView(course, w, h, head, viewRef.current ?? undefined);
        drawFrame(ctx, board, course, s, viewRef.current, ts);
      }
      const mini = miniRef.current?.getContext("2d");
      if (mini) drawMiniMap(mini, board, course, s, viewRef.current);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [course, endRun]);

  // Countdown → playing. Always starts from 3; any previous countdown timer is stopped first.
  const runCountdown = useCallback(() => {
    stopCountdown();
    setPhaseBoth("countdown");
    setCount(3);
    sound.countdown();
    let n = 3;
    countdownRef.current = setInterval(() => {
      n--;
      if (n > 0) {
        setCount(n);
        sound.countdown();
      } else {
        stopCountdown();
        setCount(0);
        sound.countdown(true);
        accRef.current = 0;
        lastTsRef.current = 0;
        setPhaseBoth("playing");
      }
    }, 650);
  }, [setPhaseBoth, stopCountdown]);

  const start = useCallback(() => {
    if (!course) return;
    sound.unlock();
    if (musicOn) sound.setMusic(true);
    stopCountdown();
    pausedFromRef.current = null;
    resetState();
    setResult(null);
    setAttempts((a) => a + 1);
    runCountdown();
  }, [course, musicOn, resetState, runCountdown, stopCountdown]);

  const pause = useCallback(() => {
    const p = phaseRef.current;
    if (p === "playing") {
      pausedFromRef.current = "playing";
      setPhaseBoth("paused");
    } else if (p === "countdown") {
      stopCountdown();
      pausedFromRef.current = "countdown";
      setPhaseBoth("paused");
    }
    // Already paused (or not in a run): ignored, so repeated blur/visibility events cause one pause.
  }, [setPhaseBoth, stopCountdown]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    const from = pausedFromRef.current;
    pausedFromRef.current = null;
    if (from === "countdown") {
      // Same game, same attempt: the 3-2-1 restarts from 3.
      runCountdown();
      return;
    }
    lastTsRef.current = 0;
    setPhaseBoth("playing");
  }, [runCountdown, setPhaseBoth]);

  /** QA-4: true while the window is unfocused and for ~500 ms after focus returns. */
  const isFocusGuarded = () => {
    const g = focusGuardRef.current;
    if (!g.active) return false;
    if (performance.now() < g.until) return true;
    g.active = false;
    return false;
  };

  /** QA-4: remember whether a mouse, touch or pen press began inside the guard. */
  const onGuardPointerDownCapture = () => {
    pressInGuardRef.current = isFocusGuarded();
  };

  /** QA-4: ignore only the click of a pointer press that began inside the guard. Keyboard and assistive-technology clicks (detail 0) always pass. */
  const onGuardClickCapture = (e: React.MouseEvent) => {
    const blocked = e.detail >= 1 && pressInGuardRef.current;
    pressInGuardRef.current = false;
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const steer = useCallback((d: Dir) => {
    sound.unlock();
    const s = stateRef.current;
    if (s && phaseRef.current === "playing") applyInput(s, d);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const p = phaseRef.current;
      const d = KEY_DIRS[e.key];
      if (d) {
        if (p === "playing" || p === "countdown") e.preventDefault();
        steer(d);
        return;
      }
      // While paused, Space on a focused pause control is not the global resume shortcut:
      // buttons activate as browsers normally do; on the Quit link Space does nothing.
      if (e.key === " " && p === "paused" && e.target instanceof HTMLElement) {
        const control = e.target.closest("[data-pause-control] button, [data-pause-control] a, button[data-pause-control]");
        if (control) {
          if (control.tagName === "A") e.preventDefault();
          return;
        }
      }
      if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (p === "playing") { e.preventDefault(); pause(); }
        else if (p === "paused") { e.preventDefault(); resume(); }
      } else if (e.key === "Enter" && (p === "ready" || p === "over")) {
        e.preventDefault();
        start();
      } else if ((e.key === "r" || e.key === "R") && (p === "paused" || p === "over")) {
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause, resume, start, steer]);

  // Auto-pause when the tab is hidden
  useEffect(() => {
    const onVis = () => document.hidden && pause();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pause]);

  // QA-4: auto-pause when the window loses focus (never auto-resume). Pointer clicks on the
  // pause controls are ignored until about 500 ms after focus returns.
  useEffect(() => {
    const onBlur = () => {
      focusGuardRef.current = { active: true, until: Number.POSITIVE_INFINITY };
      pause();
    };
    const onFocus = () => {
      if (focusGuardRef.current.active) focusGuardRef.current.until = performance.now() + 500;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [pause]);

  // Swipe on the board
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const o = swipe.current;
    if (!o) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U");
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const endSwipe = () => (swipe.current = null);

  const toggleSfx = () => {
    const v = !sfxOn;
    setSfxOn(v);
    sound.sfxEnabled = v;
    writePref("sfx", v);
  };
  const toggleMusic = () => {
    sound.unlock();
    const v = !musicOn;
    setMusicOn(v);
    sound.setMusic(v);
    writePref("music", v);
  };

  if (!course) {
    return <p className="p-10 text-center text-slate-400">{t("game.notFound")}</p>;
  }

  const total = course.apples.length;
  const courseName = t(course.nameKey);
  const effectRows: { kind: PowerUpKind; left: number; max: number; on: boolean }[] = [
    { kind: "boost", left: hud.boostLeft, max: POWERUP_TICKS.boost, on: hud.boostLeft > 0 },
    { kind: "shield", left: hud.shield ? 1 : 0, max: 1, on: hud.shield },
    { kind: "magnet", left: hud.magnetLeft, max: POWERUP_TICKS.magnet, on: hud.magnetLeft > 0 },
    { kind: "energy", left: hud.energyLeft, max: POWERUP_TICKS.energy, on: hud.energyLeft > 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="truncate font-display text-lg font-black uppercase text-white sm:text-2xl">{courseName}</h1>
          {!lockSpeed && <p className="text-xs font-bold uppercase tracking-wider text-neon-magenta">{t("game.practiceBadge")}</p>}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-neon-gold/50 bg-arena-panel px-3 py-2 shadow-glow-gold" aria-label={t("game.time")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffc832" strokeWidth="2" aria-hidden><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
          <span ref={timerRef} className="font-mono text-xl font-bold tabular-nums text-neon-gold sm:text-2xl">00:00.00</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-red-400/50 bg-arena-panel px-3 py-2" aria-label={t("game.apples")}>
          <IconApple width={20} height={20} className="text-red-400" />
          <span className="font-display text-lg font-bold tabular-nums text-white">{hud.apples}/{total}</span>
        </div>
        <button
          type="button"
          onClick={() => (phase === "playing" ? pause() : phase === "paused" ? resume() : undefined)}
          onPointerDownCapture={onGuardPointerDownCapture}
          onClickCapture={onGuardClickCapture}
          data-pause-control=""
          disabled={phase !== "playing" && phase !== "paused"}
          aria-label={t("game.pause")}
          className="focus-ring rounded-xl border border-neon-cyan/50 bg-arena-panel p-2.5 text-neon-cyan disabled:opacity-40"
        >
          {phase === "paused" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4l13 8-13 8z" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          )}
        </button>
        <ToggleIcon on={sfxOn} onClick={toggleSfx} label={t("game.sound")} path="M4 9v6h4l5 4V5L8 9H4zm12 .5a4 4 0 010 5M18.5 7a7 7 0 010 10" />
        <ToggleIcon on={musicOn} onClick={toggleMusic} label={t("game.music")} path="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          {/* Board */}
          <div
            ref={containerRef}
            className="relative h-[58vh] w-full touch-none overflow-hidden rounded-2xl border border-neon-cyan/40 bg-arena-black shadow-glow-cyan sm:h-[62vh] lg:h-[min(70vh,680px)]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endSwipe}
            onPointerCancel={endSwipe}
          >
            {/* absolutely positioned so the canvas can never resize its own container (feedback loop) */}
            <canvas ref={canvasRef} className="absolute inset-0 block" role="img" aria-label={courseName} />

            {/* Mini-map */}
            <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-neon-cyan/40 bg-arena-black/70 p-1 backdrop-blur">
              <canvas ref={miniRef} width={150} height={96} className="block h-[64px] w-[100px] sm:h-[96px] sm:w-[150px]" aria-label={t("game.miniMap")} />
            </div>

            <AnimatePresence>
              {phase === "ready" && (
                <Overlay key="ready">
                  <h2 className="font-display text-3xl font-black uppercase text-neon-green text-glow-green">{t("game.ready.title")}</h2>
                  <p className="mt-3 text-lg text-white">{t("game.ready.goal", { count: total })}</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-400">{t("game.ready.rules")}</p>
                  {!lockSpeed && (
                    <div className="mt-5" role="radiogroup" aria-label={t("game.speed")}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{t("game.speed")}</p>
                      <div className="flex gap-2">
                        {(["slow", "normal", "fast"] as const).map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            role="radio"
                            aria-checked={speed === sp}
                            onClick={() => setSpeed(sp)}
                            className={cn(
                              "focus-ring rounded-lg border px-4 py-2 text-sm font-bold uppercase",
                              speed === sp ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-arena-border text-slate-400 hover:text-white",
                            )}
                          >
                            {t(`game.speeds.${sp}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <NeonButton size="lg" className="mt-6" onClick={start} icon={<IconBolt width={20} height={20} />}>
                    {t("game.ready.start")}
                  </NeonButton>
                  <p className="mt-3 hidden text-xs text-slate-500 sm:block">{t("game.ready.hint")}</p>
                </Overlay>
              )}

              {phase === "countdown" && (
                <motion.div key="cd" className="pointer-events-none absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.span
                    key={count}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-display text-8xl font-black text-neon-gold"
                    style={{ textShadow: "0 0 30px rgba(255,200,50,.8)" }}
                  >
                    {count > 0 ? count : t("game.go")}
                  </motion.span>
                </motion.div>
              )}

              {phase === "paused" && (
                <Overlay key="paused">
                  <h2 className="font-display text-3xl font-black uppercase text-neon-cyan text-glow-cyan">{t("game.paused.title")}</h2>
                  <div
                    className="mt-6 flex flex-col gap-3 sm:flex-row"
                    data-pause-control=""
                    onPointerDownCapture={onGuardPointerDownCapture}
                    onClickCapture={onGuardClickCapture}
                  >
                    <NeonButton onClick={resume}>{t("game.paused.resume")}</NeonButton>
                    <NeonButton variant="purple" onClick={start}>{t("game.paused.restart")}</NeonButton>
                    <NeonLink href={exitHref} variant="ghost">{t("game.paused.quit")}</NeonLink>
                  </div>
                </Overlay>
              )}

              {phase === "over" && result && (
                <Overlay key="over">
                  {result.status === "complete" ? (
                    <>
                      <motion.h2
                        initial={{ scale: 0.6, rotate: -4 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="bg-gradient-to-b from-neon-gold to-orange-500 bg-clip-text font-display text-5xl font-black uppercase italic text-transparent"
                      >
                        {t("game.win.title")}
                      </motion.h2>
                      {result.newBest && <p className="mt-2 font-display font-bold uppercase text-neon-green">{t("game.win.newBest")}</p>}
                      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t("game.win.finalTime")}</p>
                      <p className="font-mono text-5xl font-black tabular-nums text-white">{formatTime(result.timeMs)}</p>
                      {result.best !== null && !result.newBest && (
                        <p className="mt-2 text-sm text-slate-400">{t("game.win.best", { time: formatTime(result.best) })}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="bg-gradient-to-b from-neon-magenta to-neon-purple bg-clip-text font-display text-5xl font-black uppercase italic text-transparent">
                        {t("game.over.title")}
                      </h2>
                      <p className="mt-2 text-lg text-white">{t(`game.over.${result.deathReason ?? "wall"}`)}</p>
                      <div className="mt-4 flex gap-6">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("game.over.yourTime")}</p>
                          <p className="font-mono text-2xl font-bold tabular-nums text-white">{formatTime(result.timeMs)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("game.over.applesCollected")}</p>
                          <p className="font-display text-2xl font-bold text-white">{result.applesCollected}/{total}</p>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <NeonButton onClick={start}>{t("game.over.tryAgain")}</NeonButton>
                    <NeonLink href={exitHref} variant="purple">{t("game.over.back")}</NeonLink>
                  </div>
                </Overlay>
              )}
            </AnimatePresence>
          </div>

          <TouchPad onDir={steer} className="mt-4 lg:hidden" />
        </div>

        {/* Side panel */}
        <aside className="space-y-4">
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-white">{t("game.state.title")}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Stat label={t("game.speed")} value={t(`game.speeds.${speed}`)} />
              <Stat label={t("game.moves")} value={String(hud.moves)} />
              <Stat label={t("game.attempts")} value={String(attempts)} />
              <Stat
                label={t("game.state.title")}
                value={t(`game.state.${hud.terrain}`)}
                tone={hud.terrain === "water" ? "text-sky-400" : hud.terrain === "boost" ? "text-neon-gold" : "text-neon-green"}
              />
            </dl>
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-white">{t("game.powerups.title")}</h2>
            <ul className="space-y-2.5">
              {effectRows.map(({ kind, left, max, on }) => (
                <li key={kind} className={cn("rounded-lg border p-2 transition-colors", on ? "border-current bg-white/5" : "border-arena-border opacity-60")} style={{ color: PICKUP_STYLE[kind].color }}>
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>{t(`game.powerups.${kind}`)}</span>
                    {on && <span className="text-xs">{kind === "shield" ? t("game.powerups.ready") : `${((left * TICK_MS) / 1000).toFixed(1)}s`}</span>}
                  </div>
                  <p className="text-xs text-slate-400">{t(`game.powerups.${kind}Desc`)}</p>
                  {on && kind !== "shield" && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-arena-black">
                      <div className="h-full rounded-full bg-current" style={{ width: `${(left / max) * 100}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-4 text-sm">
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-white">{t("game.legend.title")}</h2>
            <ul className="space-y-1.5 text-slate-300">
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm bg-[#0b2e5c] ring-1 ring-sky-400/60" />{t("game.legend.water")}</li>
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm bg-[#7a5532] ring-1 ring-neon-gold/70" />{t("game.legend.bridge")}</li>
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-[#2a0d4d] ring-2 ring-neon-purple" />{t("game.legend.tunnel")}</li>
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm bg-[#3b4254] ring-1 ring-neon-purple/60" />{t("game.legend.rock")}</li>
            </ul>
            <h2 className="mb-2 mt-4 font-display text-sm font-bold uppercase tracking-wider text-white">{t("game.controls.title")}</h2>
            <ul className="space-y-1 text-slate-400">
              <li className="hidden lg:list-item">{t("game.controls.keyboard")}</li>
              <li className="hidden lg:list-item">{t("game.controls.pause")}</li>
              <li className="hidden lg:list-item">{t("game.controls.restart")}</li>
              <li className="lg:hidden">{t("game.controls.touch")}</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain touch-pan-y bg-arena-black/75 p-6 text-center backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-arena-border bg-arena-black/50 p-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("font-display text-sm font-bold", tone)}>{value}</dd>
    </div>
  );
}

function ToggleIcon({ on, onClick, label, path }: { on: boolean; onClick: () => void; label: string; path: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring relative rounded-xl border bg-arena-panel p-2.5 transition-colors",
        on ? "border-neon-purple/60 text-neon-purple" : "border-arena-border text-slate-600",
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={path} />
      </svg>
      {!on && <span className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-slate-500" />}
    </button>
  );
}
