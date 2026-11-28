"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useT } from "@/i18n/I18nProvider";
import type { FrameStats } from "../dragon/DragonLabScene";
import { QUALITY_ORDER, defaultQuality, type Quality } from "../dragon/quality";
import { LAB_START_SKIN } from "../dragon/skins";
import { NEUTRAL } from "../world3d/controls";
import { hashHex, replay } from "../world3d/replay";
import { GOLDEN, SCRIPTED_FLIGHTS } from "../world3d/scripted";
import type { FlightController, Hud } from "./FlightScene";
import { FLIGHT_KEYS, frameFrom, NO_TOUCH, type TouchState } from "./input";
import { FlightSession, Playback, type Size } from "./session";
import { TouchControls } from "./TouchControls";

// three.js and the scene load only on this page, only in the browser.
const FlightScene = dynamic(() => import("./FlightScene"), { ssr: false });

const BENCH_SECONDS = 30;
type Bench = { running: boolean; secondsLeft: number; result?: { avgFps: number; low1Fps: number; worstMs: number } };

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function newController(size: Size): FlightController {
  return { session: new FlightSession(size), playback: null, input: NEUTRAL, look: { yaw: 0, pitch: 0, dragging: false }, paused: false, reset: 0 };
}

export function FlightClient() {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [touch, setTouch] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [size, setSize] = useState<Size>(12);
  const [quality, setQuality] = useState<Quality>("medium");
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState(false);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [replayResult, setReplayResult] = useState<"match" | "mismatch" | null>(null);
  const [tests, setTests] = useState<{ name: string; hash: string; ok: boolean }[] | null>(null);
  const [bench, setBench] = useState<Bench>({ running: false, secondsLeft: BENCH_SECONDS });
  const benchFrames = useRef<number[] | null>(null);

  const controller = useRef<FlightController | null>(null);
  if (!controller.current) controller.current = newController(12);
  const ctrl = controller as { current: FlightController };
  const keys = useRef(new Set<string>());
  const touchState = useRef<TouchState>({ ...NO_TOUCH });
  const view = useRef<HTMLDivElement>(null);

  const updateInput = useCallback(() => {
    ctrl.current.input = frameFrom(keys.current, touchState.current);
  }, [ctrl]);

  useEffect(() => {
    setWebgl(hasWebGL2());
    setQuality(defaultQuality());
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    setReady(true);
  }, []);

  useEffect(() => {
    ctrl.current.paused = paused;
    // The phone controls are hidden while paused: release anything they were holding.
    if (paused) {
      touchState.current = { ...NO_TOUCH };
      ctrl.current.input = frameFrom(keys.current, touchState.current);
    }
  }, [paused, ctrl]);

  const restart = useCallback(
    (s: Size) => {
      const c = ctrl.current;
      c.session = new FlightSession(s);
      c.playback = null;
      c.reset++;
      setSize(s);
      setReplayResult(null);
    },
    [ctrl],
  );

  // Keyboard. Flight keys never scroll the page; letting go of the window releases every key.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (FLIGHT_KEYS.has(e.code)) {
        e.preventDefault();
        keys.current.add(e.code);
        updateInput();
      } else if (!e.repeat && (e.code === "KeyP" || e.code === "Escape")) {
        setPaused((p) => !p);
      } else if (!e.repeat && e.code === "KeyR") {
        restart(ctrl.current.session.size);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys.current.delete(e.code)) updateInput();
    };
    const clear = () => {
      keys.current.clear();
      touchState.current = { ...NO_TOUCH };
      updateInput();
    };
    const hidden = () => {
      if (document.hidden) {
        clear();
        setPaused(true);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [updateInput, restart, ctrl]);

  // No page scroll, pinch zoom or double-tap zoom while touching the flight view (iOS Safari too).
  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("gesturestart", stop);
    el.addEventListener("dblclick", stop);
    // The mouse wheel over the flight view must not scroll the page away from the game.
    el.addEventListener("wheel", stop, { passive: false });
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("dblclick", stop);
    };
  }, [ready]);

  // Look around by dragging the view; it eases back when released.
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const onViewDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current || !(e.target instanceof HTMLCanvasElement)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    ctrl.current.look.dragging = true;
  };
  const onViewMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const look = ctrl.current.look;
    look.yaw = Math.max(-2.4, Math.min(2.4, -(e.clientX - d.x) * 0.006));
    look.pitch = Math.max(-0.5, Math.min(0.6, (e.clientY - d.y) * 0.004));
  };
  const onViewUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    ctrl.current.look.dragging = false;
  };

  const onTouch = useCallback(
    (patch: Partial<TouchState>) => {
      touchState.current = { ...touchState.current, ...patch };
      updateInput();
    },
    [updateInput],
  );

  const replayLastMinute = () => {
    const c = ctrl.current;
    const m = c.session.lastMinute();
    c.playback = new Playback(m.from, m.changes, m.to, c.session.size, c.session.state.hash);
    c.onPlaybackEnd = (ok) => setReplayResult(ok ? "match" : "mismatch");
    c.reset++;
    setReplayResult(null);
    setPaused(false);
  };

  const stopReplay = () => {
    const c = ctrl.current;
    c.playback = null;
    c.reset++;
  };

  const runTests = () =>
    setTests(
      SCRIPTED_FLIGHTS.map((f) => {
        const hash = hashHex(replay(f.log).hash);
        return { name: f.name, hash, ok: hash === GOLDEN[f.name] };
      }),
    );

  const onFrame = useCallback((ms: number) => {
    benchFrames.current?.push(ms);
  }, []);

  useEffect(() => {
    if (!bench.running) return;
    if (bench.secondsLeft <= 0) {
      const f = benchFrames.current ?? [];
      benchFrames.current = null;
      const sorted = [...f].sort((a, b) => b - a);
      const total = f.reduce((a, b) => a + b, 0);
      const worst1 = sorted.slice(0, Math.max(1, Math.floor(f.length / 100)));
      setBench({
        running: false,
        secondsLeft: BENCH_SECONDS,
        result: {
          avgFps: total > 0 ? (f.length * 1000) / total : 0,
          low1Fps: worst1.length ? 1000 / (worst1.reduce((a, b) => a + b, 0) / worst1.length) : 0,
          worstMs: sorted[0] ?? 0,
        },
      });
      return;
    }
    const id = setTimeout(() => setBench((b) => ({ ...b, secondsLeft: b.secondsLeft - 1 })), 1000);
    return () => clearTimeout(id);
  }, [bench]);

  const pill = (active: boolean) =>
    `pointer-events-auto focus-ring rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm transition-colors ${
      active ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan" : "border-white/20 bg-black/40 text-slate-200 hover:text-white"
    }`;

  const replaying = hud?.replaying ?? false;

  return (
    <div className="mx-auto max-w-7xl sm:px-6 sm:pt-4">
      <h1 className="sr-only">{t("dragonFlight.title")}</h1>
      <div
        ref={view}
        className="relative h-[calc(100svh-4rem)] w-full touch-none select-none overflow-hidden bg-[#0a0c1c] sm:h-[min(calc(100svh-7rem),820px)] sm:rounded-2xl sm:border sm:border-arena-border"
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
        onPointerDown={onViewDown}
        onPointerMove={onViewMove}
        onPointerUp={onViewUp}
        onPointerCancel={onViewUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!ready ? null : !webgl ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-slate-300">{t("dragonLab.noWebgl")}</p>
        ) : contextLost ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-slate-300">{t("dragonLab.contextLost")}</p>
        ) : (
          <FlightScene
            controller={ctrl}
            size={size}
            paused={paused}
            skinId={LAB_START_SKIN}
            quality={quality}
            onHud={setHud}
            onStats={debug ? setStats : undefined}
            onFrame={onFrame}
            onContextLost={() => setContextLost(true)}
          />
        )}

        {/* Top overlay. Phones: buttons on top, readouts below them (no overlap). Wider screens: side by side. */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-col-reverse items-start gap-1.5 sm:flex-row sm:justify-between">
          {/* HUD */}
          <div className="pointer-events-none max-w-full rounded-lg bg-black/55 px-2.5 py-1.5 font-mono text-[11px] leading-4 text-slate-100">
          <div>
            {t("dragonFlight.hud.speed")}: {hud ? hud.speed.toFixed(0) : "–"} m/s · {t("dragonFlight.hud.altitude")}: {hud ? hud.altitude.toFixed(0) : "–"} m
          </div>
          {replaying && <div className="text-neon-cyan">{t("dragonFlight.replay.playing")}</div>}
          {replayResult && !replaying && (
            <div className={replayResult === "match" ? "text-neon-green" : "text-red-400"}>{t(`dragonFlight.replay.${replayResult}`)}</div>
          )}
          {debug && (
            <div className="mt-1 border-t border-white/15 pt-1">
              <div>
                {t("dragonFlight.debug.mode")}: {t("dragonFlight.debug.air")} · {t("dragonFlight.debug.tick")} {hud?.tick ?? "–"}
              </div>
              <div>
                {t("dragonFlight.debug.hash")}: {hud ? hashHex(hud.hash) : "–"} · {t("dragonFlight.debug.contacts")} {hud?.contacts ?? "–"}
              </div>
              <div>
                {t("dragonLab.stats.fps")}: {stats ? stats.fps.toFixed(0) : "–"} ({stats ? stats.frameMs.toFixed(1) : "–"} ms)
              </div>
              <div>
                {t("dragonLab.stats.drawCalls")}: {stats?.calls ?? "–"} · {t("dragonLab.stats.triangles")}: {stats ? (stats.triangles / 1000).toFixed(0) + "k" : "–"}
              </div>
              <div>
                {t("dragonLab.stats.gpuObjects")}: {stats ? `${stats.geometries} geo / ${stats.textures} tex` : "–"}
              </div>
              <div>
                {t("dragonLab.stats.quality")}: {t(`dragonLab.quality.${quality}`)} · three r{stats?.three ?? "–"}
              </div>
              {bench.running && <div className="text-neon-cyan">{t("dragonLab.bench.running", { seconds: bench.secondsLeft })}</div>}
              {bench.result && !bench.running && (
                <div className="text-neon-green">
                  {t("dragonLab.bench.result", { avg: bench.result.avgFps.toFixed(1), low: bench.result.low1Fps.toFixed(1), worst: bench.result.worstMs.toFixed(0) })}
                </div>
              )}
              {tests && (
                <div className="mt-1">
                  {tests.map((r) => (
                    <div key={r.name} className={r.ok ? "text-neon-green" : "text-red-400"}>
                      {r.ok ? "✓" : "✗"} {r.name} {r.hash}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

          {/* Buttons */}
          <div className="pointer-events-none flex w-full flex-wrap justify-end gap-1.5 sm:w-auto sm:max-w-[60%]">
          <button type="button" className={pill(paused)} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? t("dragonLab.play") : t("dragonLab.pause")}
          </button>
          {([12, 20] as const).map((s) => (
            <button key={s} type="button" className={pill(size === s)} aria-pressed={size === s} onClick={() => restart(s)}>
              {t("dragonFlight.size", { metres: s })}
            </button>
          ))}
          <button type="button" className={pill(debug)} aria-pressed={debug} onClick={() => setDebug((d) => !d)}>
            {t("dragonFlight.debug.toggle")}
          </button>
          {debug && (
            <div className="flex w-full flex-wrap justify-end gap-1.5">
              {QUALITY_ORDER.map((q) => (
                <button key={q} type="button" className={pill(quality === q)} aria-pressed={quality === q} onClick={() => setQuality(q)}>
                  {t(`dragonLab.quality.${q}`)}
                </button>
              ))}
              {replaying ? (
                <button type="button" className={pill(true)} onClick={stopReplay}>
                  {t("dragonFlight.replay.stop")}
                </button>
              ) : (
                <button type="button" className={pill(false)} onClick={replayLastMinute}>
                  {t("dragonFlight.replay.start")}
                </button>
              )}
              <button type="button" className={pill(false)} onClick={runTests}>
                {t("dragonFlight.debug.runTests")}
              </button>
              <button
                type="button"
                className={pill(bench.running)}
                disabled={bench.running}
                onClick={() => {
                  benchFrames.current = [];
                  setPaused(false);
                  setBench({ running: true, secondsLeft: BENCH_SECONDS });
                }}
              >
                {t("dragonLab.bench.start")}
              </button>
              <button type="button" className={pill(false)} onClick={() => restart(size)}>
                {t("dragonFlight.restart")}
              </button>
            </div>
          )}
        </div>

        </div>

        {paused && (
          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neon-cyan/60 bg-black/60 px-5 py-3 font-display text-sm font-black uppercase tracking-wider text-neon-cyan"
            onClick={() => setPaused(false)}
          >
            {t("dragonFlight.resume")}
          </button>
        )}

        {ready && touch && !paused && (
          <TouchControls
            onChange={onTouch}
            labels={{ up: t("dragonFlight.touch.up"), down: t("dragonFlight.touch.down"), boost: t("dragonFlight.touch.boost"), stick: t("dragonFlight.touch.stick") }}
          />
        )}

        {ready && !touch && (
          <p className="pointer-events-none absolute bottom-2 left-1/2 w-max max-w-[95%] -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1 text-center text-[11px] text-slate-300">
            {t("dragonFlight.keysHint")}
          </p>
        )}
      </div>
    </div>
  );
}
