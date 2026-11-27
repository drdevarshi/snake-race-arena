/**
 * Dragon body path — pure maths, no three.js, no React, no clock, no randomness.
 *
 * The head leaves a trail of points as it moves. The body is sampled along that trail at fixed
 * arc-length spacing behind the head, so it follows exactly where the head went (no corner
 * cutting, no gaps). Each sample gets an orientation frame that never flips or twists, and a
 * radius from the taper profile.
 */

export type Vec3 = { x: number; y: number; z: number };

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-12 ? scale(a, 1 / l) : v3(0, 0, 1);
};
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

const WORLD_UP = v3(0, 1, 0);

/**
 * Trail of head positions, newest first in logical order. Points closer than `minStep` to the
 * previous one are skipped, so a stationary head does not fill the buffer. The trail is trimmed
 * once it is longer than `maxLength`, so memory stays bounded.
 */
export class HeadPath {
  private pts: Vec3[] = []; // oldest → newest
  private cum: number[] = []; // cumulative length from the oldest point
  constructor(
    readonly maxLength: number,
    readonly minStep = 0.01,
  ) {}

  get size(): number {
    return this.pts.length;
  }

  /** Total trail length from the newest point back to the oldest. */
  get totalLength(): number {
    return this.cum.length ? this.cum[this.cum.length - 1] : 0;
  }

  get head(): Vec3 | undefined {
    return this.pts[this.pts.length - 1];
  }

  clear(): void {
    this.pts = [];
    this.cum = [];
  }

  push(p: Vec3): void {
    const last = this.head;
    if (last) {
      const d = distance(last, p);
      if (d < this.minStep) return;
      this.pts.push(p);
      this.cum.push(this.cum[this.cum.length - 1] + d);
    } else {
      this.pts.push(p);
      this.cum.push(0);
    }
    this.trim();
  }

  private trim(): void {
    // Keep one point beyond maxLength so sampling at exactly maxLength still interpolates.
    const total = this.totalLength;
    let drop = 0;
    while (drop + 1 < this.pts.length && total - this.cum[drop + 1] >= this.maxLength) drop++;
    if (drop > 0) {
      this.pts.splice(0, drop);
      this.cum.splice(0, drop);
      // Rebase so the oldest kept point is at 0 again.
      const base = this.cum[0];
      for (let i = 0; i < this.cum.length; i++) this.cum[i] -= base;
    }
  }

  /** Point at arc-length `d` behind the newest point. Beyond the trail it extends straight back. */
  sampleBack(d: number): Vec3 {
    const n = this.pts.length;
    if (n === 0) return v3();
    if (n === 1) return this.pts[0];
    const target = this.totalLength - d;
    if (target <= 0) {
      // Extend past the oldest point along the first segment's direction.
      const dir = normalize(sub(this.pts[0], this.pts[1]));
      return add(this.pts[0], scale(dir, -target));
    }
    if (d <= 0) return this.pts[n - 1];
    // Binary search for the segment containing `target`.
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const segLen = this.cum[hi] - this.cum[lo];
    const t = segLen > 0 ? (target - this.cum[lo]) / segLen : 0;
    return lerp(this.pts[lo], this.pts[hi], t);
  }
}

/** `count` points spaced `spacing` apart along the trail, from the head (index 0) backwards. */
export function samplePath(path: HeadPath, count: number, spacing: number): Vec3[] {
  const out: Vec3[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = path.sampleBack(i * spacing);
  return out;
}

export type Frame = {
  /** Unit tangent, pointing towards the head (direction of travel). */
  t: Vec3;
  /** Unit "up" of the body cross-section (the back); the belly is -n. */
  n: Vec3;
  /** Unit side vector, t × n completes a right-handed frame. */
  b: Vec3;
};

/** Rotates `v` by the smallest rotation that takes unit vector `from` to unit vector `to`. */
function rotateBetween(v: Vec3, from: Vec3, to: Vec3): Vec3 {
  const axis = cross(from, to);
  const s = length(axis);
  const c = dot(from, to);
  if (s < 1e-9) return c > 0 ? v : scale(v, -1); // parallel or opposite
  const k = scale(axis, 1 / s);
  // Rodrigues' rotation formula.
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/**
 * Orientation frames along the sampled points (index 0 = head).
 *
 * The head frame's "up" is world up projected onto the cross-section, so the back faces the sky
 * and the belly the ground. Every following frame is parallel-transported from the previous one
 * (rotated by the minimal rotation between tangents), which by construction never flips or
 * twists, even when the body climbs vertically.
 */
export function computeFrames(points: Vec3[]): Frame[] {
  const n = points.length;
  const frames: Frame[] = new Array(n);
  if (n === 0) return frames;
  const tangents: Vec3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ahead = points[Math.max(0, i - 1)];
    const behind = points[Math.min(n - 1, i + 1)];
    tangents[i] = normalize(sub(ahead, behind));
  }
  const t0 = tangents[0];
  let up = sub(WORLD_UP, scale(t0, dot(WORLD_UP, t0)));
  if (length(up) < 1e-6) up = sub(v3(0, 0, 1), scale(t0, t0.z)); // head pointing straight up/down
  let nrm = normalize(up);
  frames[0] = { t: t0, n: nrm, b: normalize(cross(t0, nrm)) };
  for (let i = 1; i < n; i++) {
    const t = tangents[i];
    nrm = rotateBetween(nrm, tangents[i - 1], t);
    // Re-orthogonalise against floating-point drift.
    nrm = normalize(sub(nrm, scale(t, dot(nrm, t))));
    frames[i] = { t, n: nrm, b: normalize(cross(t, nrm)) };
  }
  return frames;
}

/**
 * Body radius at position u along the body (0 = neck, 1 = tail tip), as a fraction of the
 * maximum radius. Swells just behind the neck, holds through the chest, then tapers smoothly to
 * a thin tail tip. Monotone non-increasing after the peak.
 */
export function radiusProfile(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  const NECK = 0.9; // neck ring relative to max, matches the head's neck socket
  const PEAK = 0.16; // where the body is thickest
  const TIP = 0.06; // tail tip relative to max
  if (x <= PEAK) {
    const k = smoothstep(x / PEAK);
    return NECK + (1 - NECK) * k;
  }
  const k = (x - PEAK) / (1 - PEAK);
  // Ease-in taper: stays full through the chest, narrows faster towards the tail.
  const taper = 1 - Math.pow(k, 1.6);
  return TIP + (1 - TIP) * taper;
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
