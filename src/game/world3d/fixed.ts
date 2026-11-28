/**
 * Fixed-point maths for the 3D world engine (decision D2: whole numbers only for anything that
 * decides results). Every function uses integer arithmetic on safe integers, plus the integer
 * tables in tables.ts. No Math.sin, Math.cos, Math.sqrt or other floating-point maths.
 *
 * Units
 * - Distance: millimetres (integers). The sandbox spans about ±200,000 mm.
 * - Angle: 1/65,536 of a full turn (0..65,535 wraps). 90° = 16,384.
 * - Ratios such as sine and cosine: Q16, where 65,536 means 1.0.
 */
import { CORDIC_ATAN, QUARTER_SINE } from "./tables";

export const ONE = 65536; // 1.0 in Q16
export const TURN = 65536; // one full turn in angle units
export const QUARTER = 16384;

/** Integer division rounded toward zero. Inputs must be safe integers, divisor non-zero. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** a × q, where q is Q16 (65,536 = 1.0), rounded toward zero. */
export function mulQ(a: number, q: number): number {
  return Math.trunc((a * q) / ONE);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Wraps an angle into 0..65,535. */
export function wrapAngle(a: number): number {
  const r = a % TURN;
  return r < 0 ? r + TURN : r;
}

/** Wraps an angle into −32,768..32,767 (signed difference). */
export function signedAngle(a: number): number {
  const w = wrapAngle(a);
  return w >= TURN / 2 ? w - TURN : w;
}

function quarterSine(within: number): number {
  // within: 0..16,384 → table index 0..1,024 plus a 0..15 fraction, linearly interpolated.
  const idx = within >> 4;
  const frac = within & 15;
  const a = QUARTER_SINE[idx];
  if (frac === 0) return a;
  const b = QUARTER_SINE[idx + 1];
  return a + Math.trunc(((b - a) * frac) / 16);
}

/** sin(angle) in Q16. */
export function sinQ(angle: number): number {
  const a = wrapAngle(angle);
  const quadrant = a >> 14;
  const within = a & (QUARTER - 1);
  switch (quadrant) {
    case 0:
      return quarterSine(within);
    case 1:
      return quarterSine(QUARTER - within);
    case 2:
      return 0 - quarterSine(within); // 0 - 0 is +0, never -0
    default:
      return 0 - quarterSine(QUARTER - within);
  }
}

/** cos(angle) in Q16. */
export function cosQ(angle: number): number {
  return sinQ(angle + QUARTER);
}

const MAX_SQRT_INPUT = 2 ** 52;

/** Exact integer square root: the largest r with r × r ≤ n. n must be 0..2^52. */
export function isqrt(n: number): number {
  if (!(n >= 0) || n > MAX_SQRT_INPUT || !Number.isInteger(n)) throw new RangeError(`isqrt: ${n}`);
  if (n < 2) return n;
  let x = 1;
  while (x * x < n) x *= 2; // x ≥ √n
  // Newton's method from above, all integer steps.
  for (;;) {
    const y = Math.floor((x + Math.floor(n / x)) / 2);
    if (y >= x) return x;
    x = y;
  }
}

/**
 * atan2(y, x) as an angle (0..65,535), by CORDIC with integer shifts and the CORDIC_ATAN table.
 * Accurate to within a few angle units (under 0.03°). atan2(0, 0) is 0.
 */
export function atan2Q(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  // Rotate into the right half-plane first.
  let base = 0;
  let cx = x;
  let cy = y;
  if (cx < 0) {
    base = TURN / 2;
    cx = -cx;
    cy = -cy;
  }
  // Scale up small vectors for precision; keep large ones below 2^40.
  const mag = Math.max(Math.abs(cx), Math.abs(cy));
  let scale = 1;
  while (mag * scale < 2 ** 30) scale *= 2;
  while (mag * scale > 2 ** 40) scale /= 2;
  cx = Math.trunc(cx * scale);
  cy = Math.trunc(cy * scale);
  let angle = 0; // in angle units × 256
  for (let i = 0; i < CORDIC_ATAN.length; i++) {
    const p = 2 ** i;
    const dx = Math.trunc(cy / p);
    const dy = Math.trunc(cx / p);
    if (cy > 0) {
      cx += dx;
      cy -= dy;
      angle += CORDIC_ATAN[i];
    } else {
      cx -= dx;
      cy += dy;
      angle -= CORDIC_ATAN[i];
    }
  }
  return wrapAngle(base + Math.floor((angle + 128) / 256)); // round to nearest, exactly
}

export type V3 = { x: number; y: number; z: number };

export const vec = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });

/** Length of an integer vector (exact integer square root of the squared length). */
export function length(v: V3): number {
  return isqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Horizontal (x, z) length. */
export function lengthXZ(x: number, z: number): number {
  return isqrt(x * x + z * z);
}
