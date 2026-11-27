import { describe, expect, it } from "vitest";
import {
  HeadPath,
  computeFrames,
  cross,
  distance,
  dot,
  length,
  radiusProfile,
  samplePath,
  v3,
  type Vec3,
} from "./bodyPath";

/** Figure-of-eight (lemniscate of Gerono) with a gentle vertical wave, like the showcase route. */
const eight = (t: number): Vec3 => v3(4 * Math.sin(t), 0.6 + 0.3 * Math.sin(3 * t), 3 * Math.sin(t) * Math.cos(t));
/** Rising helix: the body climbs steeply, the hardest case for twisting. */
const helix = (t: number): Vec3 => v3(1.5 * Math.cos(t), 0.9 * t, 1.5 * Math.sin(t));

function drive(curve: (t: number) => Vec3, steps: number, dt: number, maxLength = 20): HeadPath {
  const p = new HeadPath(maxLength, 0.005);
  for (let i = 0; i <= steps; i++) p.push(curve(i * dt));
  return p;
}

/** Shortest distance from point q to the polyline through `pts`. */
function distToPolyline(q: Vec3, pts: Vec3[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ab = v3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len2 = dot(ab, ab);
    const t = len2 > 0 ? Math.max(0, Math.min(1, dot(v3(q.x - a.x, q.y - a.y, q.z - a.z), ab) / len2)) : 0;
    best = Math.min(best, distance(q, v3(a.x + ab.x * t, a.y + ab.y * t, a.z + ab.z * t)));
  }
  return best;
}

describe("HeadPath", () => {
  it("returns the newest point at distance 0", () => {
    const p = drive(eight, 400, 0.01);
    expect(distance(p.sampleBack(0), eight(4))).toBeLessThan(1e-9);
  });

  it("body samples lie on the head's actual trail (no corner cutting)", () => {
    const dt = 0.005;
    const steps = 1200;
    const p = drive(eight, steps, dt);
    const trail: Vec3[] = [];
    for (let i = 0; i <= steps; i++) trail.push(eight(i * dt));
    for (const q of samplePath(p, 60, 0.15)) expect(distToPolyline(q, trail)).toBeLessThan(1e-6);
  });

  it("samples are evenly spaced along the trail", () => {
    const p = drive(eight, 1200, 0.005);
    const pts = samplePath(p, 60, 0.15);
    for (let i = 0; i + 1 < pts.length; i++) {
      // Chord ≤ arc; on this gentle curve the chord stays within 2% of the spacing.
      const d = distance(pts[i], pts[i + 1]);
      expect(d).toBeLessThanOrEqual(0.15 + 1e-9);
      expect(d).toBeGreaterThan(0.147);
    }
  });

  it("ignores a stationary head and keeps memory bounded", () => {
    const p = new HeadPath(5, 0.01);
    for (let i = 0; i < 100; i++) p.push(v3(0, 0, 0));
    expect(p.size).toBe(1);
    for (let i = 0; i < 10_000; i++) p.push(v3(i * 0.02, 0, 0));
    expect(p.totalLength).toBeLessThan(5.05);
    expect(p.size).toBeLessThan(300);
  });

  it("extends straight back when the body is longer than the trail", () => {
    const p = new HeadPath(10, 0.01);
    p.push(v3(0, 0, 0));
    p.push(v3(1, 0, 0));
    const q = p.sampleBack(3);
    expect(distance(q, v3(-2, 0, 0))).toBeLessThan(1e-9);
  });

  it("is deterministic: the same moves give identical samples", () => {
    const a = samplePath(drive(eight, 800, 0.01), 50, 0.2);
    const b = samplePath(drive(eight, 800, 0.01), 50, 0.2);
    expect(a).toEqual(b);
  });
});

describe("computeFrames", () => {
  function checkFrames(curve: (t: number) => Vec3, steps: number, dt: number) {
    const pts = samplePath(drive(curve, steps, dt, 40), 120, 0.12);
    const frames = computeFrames(pts);
    for (const f of frames) {
      expect(Math.abs(length(f.t) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(length(f.n) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(dot(f.t, f.n))).toBeLessThan(1e-9);
      // b = t × n, right-handed
      const c = cross(f.t, f.n);
      expect(distance(c, f.b)).toBeLessThan(1e-9);
    }
    // No flips or sudden twists between neighbouring rings.
    for (let i = 0; i + 1 < frames.length; i++) expect(dot(frames[i].n, frames[i + 1].n)).toBeGreaterThan(0.97);
    return frames;
  }

  it("gives orthonormal, twist-free frames on the figure-of-eight", () => {
    const frames = checkFrames(eight, 1500, 0.005);
    // On a mostly level route the back faces up.
    expect(frames[0].n.y).toBeGreaterThan(0.9);
  });

  it("stays twist-free while climbing a steep helix", () => {
    checkFrames(helix, 2000, 0.005);
  });

  it("handles a head pointing straight up", () => {
    const frames = computeFrames([v3(0, 2, 0), v3(0, 1, 0), v3(0, 0, 0)]);
    expect(Math.abs(dot(frames[0].t, frames[0].n))).toBeLessThan(1e-9);
    expect(Number.isFinite(frames[0].n.x)).toBe(true);
  });
});

describe("radiusProfile", () => {
  it("matches the neck socket at the neck and ends thin at the tail", () => {
    expect(radiusProfile(0)).toBeCloseTo(0.9, 6);
    expect(radiusProfile(1)).toBeCloseTo(0.06, 6);
    expect(radiusProfile(0.16)).toBeCloseTo(1, 6);
  });

  it("tapers smoothly and never grows after the chest", () => {
    let prev = radiusProfile(0.16);
    for (let u = 0.17; u <= 1.0001; u += 0.01) {
      const r = radiusProfile(u);
      expect(r).toBeLessThanOrEqual(prev + 1e-12);
      expect(prev - r).toBeLessThan(0.03); // no sudden steps
      prev = r;
    }
  });

  it("clamps outside 0..1", () => {
    expect(radiusProfile(-1)).toBe(radiusProfile(0));
    expect(radiusProfile(2)).toBe(radiusProfile(1));
  });
});
