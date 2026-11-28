import { add, cross, normalize, scale, sub, v3, type Vec3 } from "./bodyPath";

/**
 * The Dragon Lab showcase route: a figure-of-eight the head flies along at constant speed.
 * The two loops pass at different heights where they cross, so the body never runs into itself.
 * Pure and deterministic: the head position depends only on the distance travelled.
 */
export type Route = {
  readonly length: number;
  /** Head position after travelling `s` along the route (wraps around). */
  at(s: number): Vec3;
};

/** Raw figure-of-eight, t in [0, 2π). Crossing at t = 0 (high) and t = π (low). */
export function figureEight(t: number): Vec3 {
  return v3(5 * Math.sin(t), 0.95 + 0.55 * Math.cos(t), 3.2 * Math.sin(t) * Math.cos(t));
}

/** Arc-length parameterised route built from a closed curve, sampled `samples` times. */
export function createRoute(curve: (t: number) => Vec3 = figureEight, samples = 2048): Route {
  const pts: Vec3[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= samples; i++) pts.push(curve((i / samples) * Math.PI * 2));
  for (let i = 1; i <= samples; i++) {
    const d = pts[i - 1];
    const e = pts[i];
    cum.push(cum[i - 1] + Math.hypot(e.x - d.x, e.y - d.y, e.z - d.z));
  }
  const total = cum[samples];
  return {
    length: total,
    at(s: number): Vec3 {
      let x = s % total;
      if (x < 0) x += total;
      let lo = 0;
      let hi = samples;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= x) lo = mid;
        else hi = mid;
      }
      const f = (x - cum[lo]) / (cum[hi] - cum[lo] || 1);
      const a = pts[lo];
      const b = pts[hi];
      return v3(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    },
  };
}

/**
 * Head position with a gentle side-to-side slither added on top of the route. Because the body
 * follows the head's actual trail, the wave travels down the body like a real serpent's.
 */
export function slitherAt(route: Route, s: number, amplitude = 0.22, wavelength = 5.2): Vec3 {
  const p = route.at(s);
  const ahead = route.at(s + 0.05);
  const dir = normalize(sub(ahead, p));
  let side = cross(v3(0, 1, 0), dir);
  side = normalize(side);
  return add(p, scale(side, amplitude * Math.sin((s / wavelength) * Math.PI * 2)));
}
