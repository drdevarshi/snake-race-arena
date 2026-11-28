/**
 * Replay: re-runs a recorded input log from the start and returns the final state, whose running
 * hash covers every tick. The browser and the server run this same code, so a genuine run gives
 * the same hash on both (the basis for server verification in M6).
 */
import { decodeInput, NEUTRAL, type InputFrame, type InputLog } from "./controls";
import { createFlight, stepFlight, type FlightState } from "./flight";
import { SANDBOX } from "./world";

/** Longest run accepted: 30 minutes of 20 ms ticks. */
export const MAX_TICKS = 90_000;

export function validateLog(log: InputLog): void {
  if (log.version !== 1 || log.world !== "sandbox-v1") throw new Error("unknown log format or world");
  if (log.size !== 12 && log.size !== 20) throw new Error("invalid dragon size");
  if (!Number.isInteger(log.ticks) || log.ticks < 0 || log.ticks > MAX_TICKS) throw new Error("invalid tick count");
  let prev = -1;
  for (const [tick, code] of log.changes) {
    if (!Number.isInteger(tick) || tick <= prev || tick >= Math.max(log.ticks, 1)) throw new Error("input ticks must increase and stay inside the run");
    decodeInput(code); // throws on an invalid code
    prev = tick;
  }
}

/** Runs a log from the start; `onTick` sees the state after each tick (for tests and playback). */
export function replay(log: InputLog, onTick?: (s: FlightState) => void): FlightState {
  validateLog(log);
  const cfg = { world: SANDBOX, size: log.size };
  const s = createFlight(SANDBOX);
  let input: InputFrame = NEUTRAL;
  let next = 0;
  for (let t = 0; t < log.ticks; t++) {
    while (next < log.changes.length && log.changes[next][0] === t) {
      input = decodeInput(log.changes[next][1]);
      next++;
    }
    stepFlight(s, input, cfg);
    onTick?.(s);
  }
  return s;
}

/** The hash as 8 hex digits, as shown in the debug panel. */
export function hashHex(h: number): string {
  return (h >>> 0).toString(16).padStart(8, "0");
}
