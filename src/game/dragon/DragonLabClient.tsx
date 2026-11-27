"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, version as reactVersion } from "react";
import { useT } from "@/i18n/I18nProvider";
import type { FrameStats } from "./DragonLabScene";
import { QUALITY_ORDER, defaultQuality, type Quality } from "./quality";
import { LAB_START_SKIN, SKINS, SKIN_ORDER, type SkinId } from "./skins";

// three.js and the scene load only on this page, only in the browser.
const DragonLabScene = dynamic(() => import("./DragonLabScene"), { ssr: false });

type Bench = { running: boolean; secondsLeft: number; result?: { avgFps: number; low1Fps: number; worstMs: number; frames: number } };

const BENCH_SECONDS = 30;

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function DragonLabClient() {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [skinId, setSkinId] = useState<SkinId>(LAB_START_SKIN);
  const [quality, setQuality] = useState<Quality>("medium");
  const [paused, setPaused] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [bench, setBench] = useState<Bench>({ running: false, secondsLeft: BENCH_SECONDS });
  const benchFrames = useRef<number[] | null>(null);

  useEffect(() => {
    setWebgl(hasWebGL2());
    setQuality(defaultQuality());
    setReady(true);
  }, []);

  const onFrame = useCallback((ms: number) => {
    benchFrames.current?.push(ms);
  }, []);

  const startBench = () => {
    benchFrames.current = [];
    setPaused(false);
    setShowStats(true);
    setBench({ running: true, secondsLeft: BENCH_SECONDS });
  };

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
          frames: f.length,
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
    `focus-ring rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
      active ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-arena-border text-slate-300 hover:text-white"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-black uppercase sm:text-4xl">
          <span className="text-neon-gradient">{t("dragonLab.title")}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400 sm:text-base">{t("dragonLab.subtitle")}</p>
      </header>

      <div className="relative h-[min(72svh,760px)] w-full touch-none overflow-hidden rounded-2xl border border-arena-border bg-[#030306]">
        {!ready ? null : !webgl ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-slate-300">{t("dragonLab.noWebgl")}</p>
        ) : contextLost ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-slate-300">{t("dragonLab.contextLost")}</p>
        ) : (
          <DragonLabScene
            skinId={skinId}
            quality={quality}
            paused={paused}
            onStats={showStats ? setStats : undefined}
            onFrame={onFrame}
            onContextLost={() => setContextLost(true)}
          />
        )}

        {showStats && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/70 p-2 font-mono text-[11px] leading-4 text-slate-200">
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
              {t("dragonLab.stats.quality")}: {t(`dragonLab.quality.${quality}`)}
            </div>
            <div className="mt-1 text-slate-400">
              React {reactVersion} · R3F {stats?.r3f ?? "–"} · three r{stats?.three ?? "–"}
            </div>
            {bench.running && <div className="mt-1 text-neon-cyan">{t("dragonLab.bench.running", { seconds: bench.secondsLeft })}</div>}
            {bench.result && !bench.running && (
              <div className="mt-1 text-neon-green">
                {t("dragonLab.bench.result", {
                  avg: bench.result.avgFps.toFixed(1),
                  low: bench.result.low1Fps.toFixed(1),
                  worst: bench.result.worstMs.toFixed(0),
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("dragonLab.skin")}</span>
        {SKIN_ORDER.map((id) => (
          <button key={id} type="button" className={pill(skinId === id)} aria-pressed={skinId === id} onClick={() => setSkinId(id)}>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SKINS[id].glow }} aria-hidden />
            {t(SKINS[id].nameKey)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("dragonLab.qualityLabel")}</span>
        {QUALITY_ORDER.map((q) => (
          <button key={q} type="button" className={pill(quality === q)} aria-pressed={quality === q} onClick={() => setQuality(q)}>
            {t(`dragonLab.quality.${q}`)}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-arena-border" aria-hidden />
        <button type="button" className={pill(paused)} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? t("dragonLab.play") : t("dragonLab.pause")}
        </button>
        <button type="button" className={pill(showStats)} aria-pressed={showStats} onClick={() => setShowStats((s) => !s)}>
          {t("dragonLab.statsToggle")}
        </button>
        <button type="button" className={pill(bench.running)} disabled={bench.running || !webgl} onClick={startBench}>
          {t("dragonLab.bench.start")}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">{t("dragonLab.hint")}</p>
    </div>
  );
}
