"use client";

/** Device-local personal best for practice runs. Ranked times come from the server (Phase 4). */
const key = (courseId: string, speed: string) => `sra:best:${courseId}:${speed}`;

export function readBest(courseId: string, speed: string): number | null {
  try {
    const v = window.localStorage.getItem(key(courseId, speed));
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeBest(courseId: string, speed: string, ms: number) {
  try {
    window.localStorage.setItem(key(courseId, speed), String(ms));
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

export function readPref(name: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(`sra:pref:${name}`);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

export function writePref(name: string, value: boolean) {
  try {
    window.localStorage.setItem(`sra:pref:${name}`, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
