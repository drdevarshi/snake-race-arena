/**
 * Player input for the 3D world engine. Each 20 ms tick the engine receives one InputFrame of small
 * integers. The browser turns keys, joystick and buttons into these numbers; the engine never sees
 * floating-point input. Logs store only the ticks where the input changed, so they stay small.
 */

/** Joystick and key axes run from −8 to +8. */
export const AXIS_MAX = 8;

export type InputFrame = {
  /** −8 (full left) … +8 (full right). */
  turn: number;
  /** −8 (full back) … +8 (full forward). */
  throttle: number;
  /** Climb (Space / Up button). */
  up: boolean;
  /** Descend (Shift or C / Down button). */
  down: boolean;
  /** Boost while held (E / Boost button). */
  boost: boolean;
};

export const NEUTRAL: Readonly<InputFrame> = Object.freeze({ turn: 0, throttle: 0, up: false, down: false, boost: false });

function axisOk(v: number): boolean {
  return Number.isInteger(v) && v >= -AXIS_MAX && v <= AXIS_MAX;
}

export function isValidInput(f: InputFrame): boolean {
  return axisOk(f.turn) && axisOk(f.throttle) && typeof f.up === "boolean" && typeof f.down === "boolean" && typeof f.boost === "boolean";
}

/** Packs a frame into one integer (0 … 8,191). */
export function encodeInput(f: InputFrame): number {
  if (!isValidInput(f)) throw new RangeError("invalid input frame");
  return (f.turn + AXIS_MAX) | ((f.throttle + AXIS_MAX) << 5) | (f.up ? 1 << 10 : 0) | (f.down ? 1 << 11 : 0) | (f.boost ? 1 << 12 : 0);
}

export function decodeInput(code: number): InputFrame {
  if (!Number.isInteger(code) || code < 0 || code >= 1 << 13) throw new RangeError("invalid input code");
  const turn = (code & 31) - AXIS_MAX;
  const throttle = ((code >> 5) & 31) - AXIS_MAX;
  const f = { turn, throttle, up: (code & (1 << 10)) !== 0, down: (code & (1 << 11)) !== 0, boost: (code & (1 << 12)) !== 0 };
  if (!isValidInput(f)) throw new RangeError("invalid input code");
  return f;
}

/** A recorded run: which world and dragon size, and the input changes as [tick, code] pairs. */
export type InputLog = {
  version: 1;
  world: "sandbox-v1";
  size: 12 | 20;
  /** Number of ticks the run lasted. */
  ticks: number;
  /** Input changes, ticks strictly increasing; the input holds until the next change. */
  changes: [number, number][];
};

/** Records inputs tick by tick, keeping only the changes. */
export class InputRecorder {
  private last = -1;
  readonly changes: [number, number][] = [];

  record(tick: number, frame: InputFrame): void {
    const code = encodeInput(frame);
    if (code !== this.last) {
      this.changes.push([tick, code]);
      this.last = code;
    }
  }
}
