/**
 * Turns keys, the on-screen joystick and buttons into the engine's integer InputFrame.
 *
 * Keyboard: W/S speed, A/D or ←/→ turn, ↑ or Space climb, ↓ or Shift or C descend, E boost.
 * (↑/↓ climb and descend, like the Up and Down buttons on the phone.)
 * Phone: the left joystick turns (sideways) and sets the throttle (up/down); Up, Down and Boost
 * buttons on the right can be held at the same time as the joystick.
 */
import { AXIS_MAX, type InputFrame } from "../world3d/controls";

export type KeyState = Set<string>;

/** Keys the flight page handles (their default browser action, like scrolling, is prevented). */
export const FLIGHT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyC",
  "KeyE",
]);

export type TouchState = {
  /** Joystick, −1…1 each (x right, y forward); 0,0 when released. */
  stickX: number;
  stickY: number;
  up: boolean;
  down: boolean;
  boost: boolean;
};

export const NO_TOUCH: TouchState = { stickX: 0, stickY: 0, up: false, down: false, boost: false };

/** −1…1 → −8…8, with a small dead zone so a resting thumb doesn't drift. */
export function axis(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const c = Math.max(-1, Math.min(1, v));
  if (Math.abs(c) < 0.12) return 0;
  // Rescale outside the dead zone so the full range is still reachable.
  const s = (Math.abs(c) - 0.12) / 0.88;
  const r = Math.round(Math.sign(c) * s * AXIS_MAX);
  return r === 0 ? 0 : r; // never -0
}

export function frameFrom(keys: KeyState, touch: TouchState): InputFrame {
  const has = (...codes: string[]) => codes.some((c) => keys.has(c));
  const keyTurn = (has("KeyD", "ArrowRight") ? AXIS_MAX : 0) - (has("KeyA", "ArrowLeft") ? AXIS_MAX : 0);
  const keyThrottle = (has("KeyW") ? AXIS_MAX : 0) - (has("KeyS") ? AXIS_MAX : 0);
  const clampAxis = (v: number) => Math.max(-AXIS_MAX, Math.min(AXIS_MAX, v)) || 0;
  return {
    turn: clampAxis(keyTurn + axis(touch.stickX)),
    throttle: clampAxis(keyThrottle + axis(touch.stickY)),
    up: has("Space", "ArrowUp") || touch.up,
    down: has("ShiftLeft", "ShiftRight", "KeyC", "ArrowDown") || touch.down,
    boost: has("KeyE") || touch.boost,
  };
}
