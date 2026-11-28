/**
 * Free-flight engine for M2a (air mode only). Pure and deterministic: whole numbers only, a fixed
 * 20 ms tick, no clock, no randomness, no browser APIs. The same input log gives the same flight,
 * in any browser and on the server.
 *
 * Assisted flight (decision D3): when the player lets go, climbing or diving and banking ease back
 * to level along a straight ramp (no overshoot) within about 1.2 s; speed holds; any input takes
 * over on the very next tick.
 *
 * Coordinates: millimetres; y is up. Heading (yaw) 0 faces +z; a positive turn input (right)
 * lowers the yaw.
 */
import { NEUTRAL, type InputFrame } from "./controls";
import { atan2Q, clamp, cosQ, mulQ, sinQ, wrapAngle } from "./fixed";
import { resolveCollisions } from "./collide";
import { SANDBOX, type World } from "./world";

export const TICK_MS = 20;

/** Tuning, per tick (20 ms). Speeds in mm per tick: 50 mm/tick = 2.5 m/s. */
export const FLIGHT = {
  cruise: 500, // 25 m/s, the starting speed
  max: 800, // 40 m/s with full forward
  boostMax: 1040, // 52 m/s while boosting
  reverse: -100, // −5 m/s with full back
  accel: 6, // 15 m/s² toward a faster target
  brake: 8, // 20 m/s² toward a slower target
  turnRate: 328, // angle units per tick at full stick ≈ 90°/s
  climb: 240, // 12 m/s up or down
  climbAccel: 12, // reach full climb in 0.4 s
  levelRate: 4, // ease back from full climb to level in 1.2 s
  bankMax: 6_371, // 35°
  bankRate: 180, // reach full bank or level out in 0.7 s
  pitchMax: 10_923, // 60°
} as const;

/** Dragon size (m) → head collision radius (mm). */
export const HEAD_RADIUS: Record<12 | 20, number> = { 12: 600, 20: 1_000 };

export type FlightState = {
  tick: number;
  x: number;
  y: number;
  z: number;
  /** Heading, 0..65,535. */
  yaw: number;
  /** Nose up (+) or down (−), from climb rate and speed; ±60°. */
  pitch: number;
  /** Roll into turns (visual lean, decided by the engine so replays match exactly); ±35°. */
  bank: number;
  /** Forward speed, mm per tick. */
  speed: number;
  /** Vertical speed, mm per tick. */
  vy: number;
  /** Ticks spent touching something solid. */
  contacts: number;
  /** Running FNV-1a hash of every tick's state: identical runs give identical hashes. */
  hash: number;
};

export type FlightConfig = { world: World; size: 12 | 20 };

export function createFlight(world: World = SANDBOX): FlightState {
  const s = world.start;
  const state: FlightState = { tick: 0, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0, bank: 0, speed: FLIGHT.cruise, vy: 0, contacts: 0, hash: 0x811c9dc5 };
  state.hash = hashState(state);
  return state;
}

/** Moves `v` toward `target` by at most `step`, never past it. */
function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

const FNV_PRIME = 16777619;

function mix(h: number, v: number): number {
  return Math.imul(h ^ (v | 0), FNV_PRIME) >>> 0;
}

/** Folds the current state into its running hash. */
export function hashState(s: FlightState): number {
  let h = s.hash;
  for (const v of [s.tick, s.x, s.y, s.z, s.yaw, s.pitch, s.bank, s.speed, s.vy, s.contacts]) h = mix(h, v);
  return h;
}

/** Advances the flight by one 20 ms tick, in place. */
export function stepFlight(s: FlightState, input: InputFrame, cfg: FlightConfig): void {
  const i = input ?? NEUTRAL;

  // Speed: forward accelerates toward cruise…max, back brakes toward hover or reverse,
  // releasing holds the current speed.
  const top = i.boost ? FLIGHT.boostMax : FLIGHT.max;
  if (i.boost && i.throttle <= 0) {
    s.speed = approach(s.speed, top, FLIGHT.accel);
  } else if (i.throttle > 0) {
    const target = FLIGHT.cruise + Math.trunc(((top - FLIGHT.cruise) * i.throttle) / 8);
    s.speed = approach(s.speed, target, s.speed < target ? FLIGHT.accel : FLIGHT.brake);
  } else if (i.throttle < 0) {
    s.speed = approach(s.speed, Math.trunc((FLIGHT.reverse * -i.throttle) / 8), FLIGHT.brake);
  }

  // Heading: takes effect at once.
  s.yaw = wrapAngle(s.yaw - Math.trunc((FLIGHT.turnRate * i.turn) / 8));

  // Climb and dive; when released, level out along a straight ramp (no overshoot).
  const climb = (i.up ? 1 : 0) - (i.down ? 1 : 0);
  if (climb !== 0) s.vy = approach(s.vy, climb * FLIGHT.climb, FLIGHT.climbAccel);
  else s.vy = approach(s.vy, 0, FLIGHT.levelRate);

  // Lean into turns; level out when released.
  s.bank = approach(s.bank, 0 - Math.trunc((FLIGHT.bankMax * i.turn) / 8), FLIGHT.bankRate); // 0 - x avoids -0

  // Move.
  s.x += mulQ(s.speed, sinQ(s.yaw));
  s.z += mulQ(s.speed, cosQ(s.yaw));
  s.y += s.vy;

  if (resolveCollisions(s, cfg.world, HEAD_RADIUS[cfg.size])) s.contacts++;

  // Nose angle follows the actual climb and speed.
  let pitch = atan2Q(s.vy, Math.abs(s.speed) + 60);
  if (pitch >= 32_768) pitch -= 65_536;
  s.pitch = clamp(pitch, -FLIGHT.pitchMax, FLIGHT.pitchMax);

  s.tick++;
  s.hash = hashState(s);
}
