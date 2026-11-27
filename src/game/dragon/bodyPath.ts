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
    return this.sampleBackInto(d, v3());
  }

  /** Same as sampleBack, written into `out` (no allocation; used every frame). */
  sampleBackInto(d: number, out: Vec3): Vec3 {
    const n = this.pts.length;
    if (n === 0) return set(out, 0, 0, 0);
    if (n === 1) return set(out, this.pts[0].x, this.pts[0].y, this.pts[0].z);
    const target = this.totalLength - d;
    if (target <= 0) {
      // Extend past the oldest point along the first segment's direction.
      const a = this.pts[0];
      const b = this.pts[1];
      const len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) || 1;
      const k = -target / len;
      return set(out, a.x + (a.x - b.x) * k, a.y + (a.y - b.y) * k, a.z + (a.z - b.z) * k);
    }
    if (d <= 0) {
      const h = this.pts[n - 1];
      return set(out, h.x, h.y, h.z);
    }
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
    const a = this.pts[lo];
    const b = this.pts[hi];
    return set(out, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  }
}

function set(o: Vec3, x: number, y: number, z: number): Vec3 {
  o.x = x;
  o.y = y;
  o.z = z;
  return o;
}

/** `count` points spaced `spacing` apart along the trail, from the head (index 0) backwards. */
export function samplePath(path: HeadPath, count: number, spacing: number): Vec3[] {
  const out: Vec3[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = path.sampleBack(i * spacing);
  return out;
}

/** Same as samplePath, written into the existing points of `out` (its length is the count). */
export function samplePathInto(path: HeadPath, out: Vec3[], spacing: number): Vec3[] {
  for (let i = 0; i < out.length; i++) path.sampleBackInto(i * spacing, out[i]);
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

/**
 * Orientation frames along the sampled points (index 0 = head).
 *
 * The head frame's "up" is world up projected onto the cross-section, so the back faces the sky
 * and the belly the ground. Every following frame is parallel-transported from the previous one
 * (rotated by the minimal rotation between tangents), which by construction never flips or
 * twists, even when the body climbs vertically.
 */
export function computeFrames(points: Vec3[]): Frame[] {
  const frames: Frame[] = points.map(() => ({ t: v3(), n: v3(), b: v3() }));
  return computeFramesInto(points, frames);
}

/**
 * Same as computeFrames, written into existing frames (one per point) with plain arithmetic, so
 * the per-frame body update creates no garbage for the phone to collect.
 */
export function computeFramesInto(points: Vec3[], frames: Frame[]): Frame[] {
  const n = points.length;
  if (n === 0) return frames;
  let ptx = 0, pty = 0, ptz = 0; // previous tangent
  let nx = 0, ny = 0, nz = 0; // transported normal
  for (let i = 0; i < n; i++) {
    const ahead = points[Math.max(0, i - 1)];
    const behind = points[Math.min(n - 1, i + 1)];
    let tx = ahead.x - behind.x, ty = ahead.y - behind.y, tz = ahead.z - behind.z;
    const tl = Math.hypot(tx, ty, tz);
    if (tl > 1e-12) {
      tx /= tl;
      ty /= tl;
      tz /= tl;
    } else {
      tx = 0;
      ty = 0;
      tz = 1;
    }
    if (i === 0) {
      // World up projected onto the cross-section; fallback when the head points straight up/down.
      nx = -ty * tx;
      ny = 1 - ty * ty;
      nz = -ty * tz;
      if (Math.hypot(nx, ny, nz) < 1e-6) {
        nx = -tz * tx;
        ny = -tz * ty;
        nz = 1 - tz * tz;
      }
    } else {
      // Rotate the previous normal by the minimal rotation from the previous tangent to this one.
      const ax = pty * tz - ptz * ty, ay = ptz * tx - ptx * tz, az = ptx * ty - pty * tx;
      const s = Math.hypot(ax, ay, az);
      const c = ptx * tx + pty * ty + ptz * tz;
      if (s >= 1e-9) {
        const kx = ax / s, ky = ay / s, kz = az / s;
        const kv = kx * nx + ky * ny + kz * nz;
        const cx = ky * nz - kz * ny, cy = kz * nx - kx * nz, cz = kx * ny - ky * nx;
        const rx = nx * c + cx * s + kx * kv * (1 - c);
        const ry = ny * c + cy * s + ky * kv * (1 - c);
        const rz = nz * c + cz * s + kz * kv * (1 - c);
        nx = rx;
        ny = ry;
        nz = rz;
      } else if (c < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      // Re-orthogonalise against floating-point drift.
      const d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d;
      ny -= ty * d;
      nz -= tz * d;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const f = frames[i];
    set(f.t, tx, ty, tz);
    set(f.n, nx, ny, nz);
    // b = t × n
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    const bl = Math.hypot(bx, by, bz) || 1;
    set(f.b, bx / bl, by / bl, bz / bl);
    ptx = tx;
    pty = ty;
    ptz = tz;
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
