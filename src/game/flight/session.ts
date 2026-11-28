/**
 * One flight in the browser: runs the deterministic engine at a fixed 20 ms tick no matter how fast
 * the screen refreshes, records every input change, keeps snapshots for "Replay last 60 s", and
 * gives the renderer an interpolation factor so motion looks smooth between ticks.
 *
 * The engine decides everything; this class only feeds it inputs and remembers them. No three.js
 * or React here, so it is tested in Node.
 */
import { decodeInput, encodeInput, InputRecorder, NEUTRAL, type InputFrame, type InputLog } from "../world3d/controls";
import { createFlight, stepFlight, TICK_MS, type FlightState } from "../world3d/flight";
import { SANDBOX } from "../world3d/world";

/** A snapshot is kept every 500 ticks (10 s). */
export const SNAPSHOT_EVERY = 500;
/** Ticks in 60 s. */
export const REPLAY_TICKS = 3000;
/** At most this many ticks per animation frame (a long stall is skipped, not fast-forwarded). */
const MAX_TICKS_PER_FRAME = 5;
/** Snapshots kept: enough to cover the last 60 s plus one. */
const SNAPSHOTS_KEPT = REPLAY_TICKS / SNAPSHOT_EVERY + 2;

export type Size = 12 | 20;

const copy = (s: FlightState): FlightState => ({ ...s });

/** Input that holds from `changes` at tick `t` (changes sorted by tick). */
function inputAt(changes: [number, number][], t: number): InputFrame {
  let code = -1;
  for (const [tick, c] of changes) {
    if (tick > t) break;
    code = c;
  }
  return code < 0 ? NEUTRAL : decodeInput(code);
}

/** Replays `changes` on a copy of `from` until tick `to`; `onTick` sees each state. */
export function resimulate(from: FlightState, changes: [number, number][], to: number, size: Size, onTick?: (s: FlightState) => void): FlightState {
  const s = copy(from);
  const cfg = { world: SANDBOX, size };
  let input = inputAt(changes, s.tick - 1);
  let next = changes.findIndex(([tick]) => tick >= s.tick);
  if (next < 0) next = changes.length;
  while (s.tick < to) {
    while (next < changes.length && changes[next][0] === s.tick) input = decodeInput(changes[next++][1]);
    stepFlight(s, input, cfg);
    onTick?.(s);
  }
  return s;
}

export class FlightSession {
  readonly size: Size;
  /** State after the latest tick. */
  state: FlightState;
  /** State one tick earlier (for interpolation). */
  prev: FlightState;
  private recorder = new InputRecorder();
  private snapshots: FlightState[] = [];
  private acc = 0;

  constructor(size: Size) {
    this.size = size;
    this.state = createFlight(SANDBOX);
    this.prev = copy(this.state);
    this.snapshots.push(copy(this.state));
  }

  /**
   * Advances real time by `dtMs` with the current input. Runs as many whole ticks as fit and
   * returns how far (0–1) the screen is between the previous and the latest tick.
   */
  advance(dtMs: number, input: InputFrame): number {
    this.acc += Math.max(0, dtMs);
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      this.tick(input);
      this.acc -= TICK_MS;
      n++;
    }
    if (n === MAX_TICKS_PER_FRAME) this.acc = Math.min(this.acc, TICK_MS);
    return this.acc / TICK_MS;
  }

  /** Runs exactly one tick (also used by tests). The input takes effect on this tick. */
  tick(input: InputFrame): void {
    this.recorder.record(this.state.tick, input);
    this.prev = copy(this.state);
    stepFlight(this.state, input, { world: SANDBOX, size: this.size });
    if (this.state.tick % SNAPSHOT_EVERY === 0) {
      this.snapshots.push(copy(this.state));
      // Always keep the starting snapshot (tick 0) so the whole run can be replayed from the start.
      if (this.snapshots.length > SNAPSHOTS_KEPT) this.snapshots.splice(1, 1);
    }
  }

  /** The whole run so far as an input log (replays from the start to the same hash). */
  log(): InputLog {
    const ticks = this.state.tick;
    return { version: 1, world: "sandbox-v1", size: this.size, ticks, changes: this.recorder.changes.filter(([t]) => t < Math.max(ticks, 1)).map(([t, c]) => [t, c]) };
  }

  /**
   * Where "Replay last 60 s" starts: the latest snapshot at least 60 s back (or the start), with the
   * inputs needed from there to now.
   */
  lastMinute(): { from: FlightState; changes: [number, number][]; to: number } {
    const to = this.state.tick;
    const target = Math.max(0, to - REPLAY_TICKS);
    let from = this.snapshots[0];
    for (const s of this.snapshots) if (s.tick <= target) from = s;
    return { from: copy(from), changes: this.recorder.changes.map(([t, c]) => [t, c] as [number, number]), to };
  }
}

/** Encodes the input for comparison (so the UI updates only when it really changes). */
export const inputKey = (f: InputFrame) => encodeInput(f);

/**
 * Plays a stretch of recorded flight back in real time (for "Replay last 60 s"). Runs the same
 * engine on the recorded inputs, so it ends on exactly the live state; `matches` says whether it did.
 */
export class Playback {
  state: FlightState;
  prev: FlightState;
  private input: InputFrame;
  private next: number;
  private acc = 0;

  constructor(
    from: FlightState,
    private readonly changes: [number, number][],
    readonly to: number,
    readonly size: Size,
    private readonly expectedHash: number,
  ) {
    this.state = copy(from);
    this.prev = copy(from);
    this.input = inputAt(changes, from.tick - 1);
    const i = changes.findIndex(([tick]) => tick >= from.tick);
    this.next = i < 0 ? changes.length : i;
  }

  get done(): boolean {
    return this.state.tick >= this.to;
  }

  get matches(): boolean {
    return this.done && this.state.hash === this.expectedHash;
  }

  /** Same contract as FlightSession.advance; stops at the end. */
  advance(dtMs: number): number {
    this.acc += Math.max(0, dtMs);
    let n = 0;
    while (!this.done && this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      while (this.next < this.changes.length && this.changes[this.next][0] === this.state.tick) this.input = decodeInput(this.changes[this.next++][1]);
      this.prev = copy(this.state);
      stepFlight(this.state, this.input, { world: SANDBOX, size: this.size });
      this.acc -= TICK_MS;
      n++;
    }
    if (n === MAX_TICKS_PER_FRAME || this.done) this.acc = Math.min(this.acc, TICK_MS - 1e-9);
    return this.done ? 1 : this.acc / TICK_MS;
  }
}
