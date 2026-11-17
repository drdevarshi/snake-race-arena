import { applyInput, createGame, step } from "./engine";
import { MAX_QUEUED_TURNS, MAX_RUN_TICKS, TICK_MS, type Course, type DeathReason, type Dir, type GameStatus, type InputEvent, type SpeedSetting } from "./types";

export interface ReplayResult {
  valid: boolean;
  /** why the input log was rejected (only when valid=false) */
  error?: "BAD_FORMAT" | "OUT_OF_ORDER" | "INPUT_REJECTED" | "TOO_LONG" | "INPUT_AFTER_END";
  status: GameStatus;
  ticks: number;
  timeMs: number | null;
  applesCollected: number;
  deathReason: DeathReason | null;
}

const VALID_DIRS = new Set<Dir>(["U", "D", "L", "R"]);

/**
 * Re-simulate a run from its input log. This is the server's source of truth:
 * the browser only ever submits inputs, never times or scores.
 *
 * Strict: every input must be one the live engine would have accepted at that
 * tick. A tampered log (reordered, impossible turns, inputs after the run ended)
 * is marked invalid rather than silently corrected.
 */
export function replay(course: Course, speed: SpeedSetting, inputs: unknown, maxTicks = MAX_RUN_TICKS): ReplayResult {
  const state = createGame(course, speed);
  const result = (valid: boolean, error?: ReplayResult["error"]): ReplayResult => ({
    valid,
    error,
    status: state.status,
    ticks: state.tick,
    timeMs: state.finishTick !== null ? state.finishTick * TICK_MS : null,
    applesCollected: state.applesCollected,
    deathReason: state.deathReason,
  });

  if (!Array.isArray(inputs) || inputs.length > maxTicks * MAX_QUEUED_TURNS) return result(false, "BAD_FORMAT");
  const log: InputEvent[] = [];
  for (const raw of inputs) {
    const ev = raw as InputEvent;
    if (!ev || typeof ev.t !== "number" || !Number.isInteger(ev.t) || ev.t < 0 || !VALID_DIRS.has(ev.d)) {
      return result(false, "BAD_FORMAT");
    }
    if (log.length && ev.t < log[log.length - 1].t) return result(false, "OUT_OF_ORDER");
    log.push({ t: ev.t, d: ev.d });
  }

  let i = 0;
  while (state.status === "running") {
    while (i < log.length && log[i].t === state.tick) {
      if (!applyInput(state, log[i].d)) return result(false, "INPUT_REJECTED");
      i++;
    }
    if (state.tick >= maxTicks) return result(false, "TOO_LONG");
    step(state, course);
  }
  if (i < log.length) return result(false, "INPUT_AFTER_END");
  return result(true);
}
