"use client";

import type { Dir } from "@/game/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";

const ARROWS: Record<Dir, string> = {
  U: "M12 6l-7 8h14z",
  D: "M12 18l-7-8h14z",
  L: "M6 12l8-7v14z",
  R: "M18 12l-8-7v14z",
};

/** On-screen D-pad for touch devices. Uses pointerdown for zero-latency steering. */
export function TouchPad({ onDir, className }: { onDir: (d: Dir) => void; className?: string }) {
  const { t } = useT();
  const btn = (d: Dir, label: string, pos: string) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onDir(d);
      }}
      className={cn(
        "flex h-16 w-16 select-none items-center justify-center rounded-2xl border border-neon-cyan/50 bg-arena-panel/90 text-neon-cyan shadow-glow-cyan active:scale-95 active:bg-neon-cyan/20",
        pos,
      )}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={ARROWS[d]} />
      </svg>
    </button>
  );
  return (
    <div className={cn("mx-auto grid w-max touch-none grid-cols-3 grid-rows-2 gap-2", className)}>
      {btn("U", t("game.controls.up"), "col-start-2 row-start-1")}
      {btn("L", t("game.controls.left"), "col-start-1 row-start-2")}
      {btn("D", t("game.controls.down"), "col-start-2 row-start-2")}
      {btn("R", t("game.controls.right"), "col-start-3 row-start-2")}
    </div>
  );
}
