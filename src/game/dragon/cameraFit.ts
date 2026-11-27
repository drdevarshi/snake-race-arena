import { createRoute, slitherAt } from "./route";

/**
 * Portrait camera framing for Dragon Lab (visual only; no effect on any result).
 *
 * The figure-of-eight is about 10 m wide but only about 3 m deep, so a narrow portrait screen
 * cannot show it side-on without moving far away. Instead of a rule of thumb, this finds, for each
 * viewing direction around the route, the closest camera distance at which everything the dragon can
 * reach stays inside the view, and picks the direction that allows the closest camera. That keeps
 * the dragon as large as possible without ever leaving the screen.
 */

type P3 = { x: number; y: number; z: number };

/** The point the orbit camera looks at (same as the orbit controls' target). */
export const TARGET: P3 = { x: 0, y: 0.9, z: 0 };
/** Default desktop camera position; its elevation is reused for portrait framing. */
export const DESKTOP_POSITION: P3 = { x: 0, y: 3.4, z: 9.5 };
/** Portrait field of view (vertical, degrees). */
export const PORTRAIT_FOV = 55;
/**
 * Space the dragon can fill around its head path (m). The widest part is the whiskers, 1.48 m from
 * the head line (measured from the built geometry in cameraFit.test.ts); the body is 0.4 m thick.
 */
export const ENVELOPE_RADIUS = 1.5;
/** Head length ahead of the neck joint (m); the snout reaches 1.73 m. */
export const HEAD_AHEAD = 1.8;
/** Fraction of the view kept free at each edge. */
const EDGE_PAD = 0.04;

/** Points the dragon's head path covers over a full loop, plus the snout ahead of each. */
export function routeEnvelope(step = 0.1): P3[] {
  const route = createRoute();
  const pts: P3[] = [];
  for (let s = 0; s < route.length; s += step) {
    const p = slitherAt(route, s);
    const q = slitherAt(route, s + 0.05);
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    pts.push(p, { x: p.x + (dx / l) * HEAD_AHEAD, y: p.y + (dy / l) * HEAD_AHEAD, z: p.z + (dz / l) * HEAD_AHEAD });
  }
  return pts;
}

/**
 * True when every sphere (point + radius) is inside the camera's view, keeping EDGE_PAD free at the
 * edges. The camera sits at `cam`, looks at TARGET, with world up = +Y.
 */
export function allInView(points: P3[], radius: number, cam: P3, vfovDeg: number, aspect: number): boolean {
  let fx = TARGET.x - cam.x, fy = TARGET.y - cam.y, fz = TARGET.z - cam.z;
  const fl = Math.hypot(fx, fy, fz);
  fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up, up' = right × forward
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const tanV = Math.tan(((vfovDeg / 2) * Math.PI) / 180) * (1 - EDGE_PAD);
  const tanH = Math.tan(((vfovDeg / 2) * Math.PI) / 180) * aspect * (1 - EDGE_PAD);
  for (const p of points) {
    const vx = p.x - cam.x, vy = p.y - cam.y, vz = p.z - cam.z;
    const depth = vx * fx + vy * fy + vz * fz - radius;
    if (depth <= 0.1) return false;
    const x = Math.abs(vx * rx + vz * rz) + radius;
    const y = Math.abs(vx * ux + vy * uy + vz * uz) + radius;
    if (x > depth * tanH || y > depth * tanV) return false;
  }
  return true;
}

/** Camera position at `distance` from TARGET, at the desktop elevation, rotated `azimuthDeg` about +Y. */
export function cameraAt(azimuthDeg: number, distance: number): P3 {
  const ex = DESKTOP_POSITION.y - TARGET.y;
  const ez = DESKTOP_POSITION.z - TARGET.z;
  const el = Math.atan2(ex, ez);
  const a = (azimuthDeg * Math.PI) / 180;
  const h = Math.cos(el) * distance;
  return { x: TARGET.x + Math.sin(a) * h, y: TARGET.y + Math.sin(el) * distance, z: TARGET.z + Math.cos(a) * h };
}

/** Smallest distance (to 1 cm) at which the whole envelope fits, searching 4–60 m. */
export function fitDistance(azimuthDeg: number, vfovDeg: number, aspect: number, points = routeEnvelope()): number {
  let lo = 4;
  let hi = 60;
  if (!allInView(points, ENVELOPE_RADIUS, cameraAt(azimuthDeg, hi), vfovDeg, aspect)) return hi;
  while (hi - lo > 0.01) {
    const mid = (lo + hi) / 2;
    if (allInView(points, ENVELOPE_RADIUS, cameraAt(azimuthDeg, mid), vfovDeg, aspect)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Best portrait placement: the viewing direction (0–180°, 5° steps) that allows the closest camera. */
export function portraitPlacement(aspect: number): { position: P3; fov: number; azimuth: number; distance: number } {
  const points = routeEnvelope();
  let best = { azimuth: 0, distance: Infinity };
  for (let az = 0; az <= 180; az += 5) {
    const d = fitDistance(az, PORTRAIT_FOV, aspect, points);
    if (d < best.distance - 1e-6) best = { azimuth: az, distance: d };
  }
  return { position: cameraAt(best.azimuth, best.distance), fov: PORTRAIT_FOV, ...best };
}
