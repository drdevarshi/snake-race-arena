/**
 * Chase camera for the free-flight sandbox. Visual only: floating point is fine here, and nothing
 * the camera does can change a result.
 *
 * The camera follows behind and above the dragon's head on springs (smooth, frame-rate
 * independent), looks a little ahead, drops below the dragon on steep climbs so the sky ahead stays
 * visible, never rolls, and is pushed out of any solid (pillars, poles, deck, ground), so the view
 * never goes inside an object.
 */
import { groundHeight, type World } from "../world3d/world";

export type Vec = { x: number; y: number; z: number };

export type RigTarget = {
  /** Head position, metres. */
  head: Vec;
  /** Heading in radians (0 faces +z). */
  yaw: number;
  /** Nose angle in radians (+ up). */
  pitch: number;
  /** Dragon length in metres (12 or 20); the camera stays further back for the big dragon. */
  size: number;
};

export type RigState = { pos: Vec; look: Vec; ready: boolean };

/** Extra space kept between the camera and any solid (m). */
export const CAMERA_CLEARANCE = 1.2;

export function createRig(): RigState {
  return { pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 }, ready: false };
}

/** Where the camera wants to be for this target (before smoothing and collision). */
export function desired(t: RigTarget, lookYaw = 0, lookPitch = 0): { pos: Vec; look: Vec } {
  // Far enough back to see the whole body (it trails the head by its full length) and what is ahead.
  const back = t.size * 1.6;
  const up = t.size * 0.5;
  const yaw = t.yaw + lookYaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // On a steep climb, lower the camera so the sky ahead stays visible.
  const climb = Math.max(0, Math.sin(t.pitch));
  const height = up - climb * back * 0.9 + Math.sin(lookPitch) * back;
  return {
    pos: { x: t.head.x - fx * back, y: t.head.y + height, z: t.head.z - fz * back },
    look: { x: t.head.x + Math.sin(t.yaw) * t.size, y: t.head.y + Math.sin(t.pitch) * t.size, z: t.head.z + Math.cos(t.yaw) * t.size },
  };
}

const solidsCache = new WeakMap<World, World["pillars"]>();
const solids = (w: World) => {
  let s = solidsCache.get(w);
  if (!s) solidsCache.set(w, (s = [...w.pillars, ...w.poles]));
  return s;
};

/**
 * Pushes a point out of every solid in the world (metres), keeping CAMERA_CLEARANCE, by the
 * shortest way out (over the top of a short pillar, or out through its side; out through the
 * nearest face of the deck; up off the ground). Because the camera moves only a short way each
 * step (see MAX_SPEED), the shortest way out is always a small, smooth correction: it slides the
 * camera along the surface instead of jumping.
 */
export function pushOut(p: Vec, w: World): void {
  const c = CAMERA_CLEARANCE;
  for (const s of solids(w)) {
    const r = s.r / 1000 + c;
    const h = s.h / 1000 + c;
    const dx = p.x - s.x / 1000;
    const dz = p.z - s.z / 1000;
    const d = Math.hypot(dx, dz);
    if (d < r && p.y < h) {
      if (h - p.y < r - d) p.y = h;
      else if (d > 1e-6) {
        p.x += (dx / d) * (r - d);
        p.z += (dz / d) * (r - d);
      } else p.x += r;
    }
  }
  const b = w.deck;
  const x0 = b.x0 / 1000 - c, x1 = b.x1 / 1000 + c, z0 = b.z0 / 1000 - c, z1 = b.z1 / 1000 + c, y0 = b.y0 / 1000 - c, y1 = b.y1 / 1000 + c;
  if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && p.y > y0 && p.y < y1) {
    const exits: [number, () => void][] = [
      [p.x - x0, () => (p.x = x0)],
      [x1 - p.x, () => (p.x = x1)],
      [p.z - z0, () => (p.z = z0)],
      [z1 - p.z, () => (p.z = z1)],
      [p.y - y0, () => (p.y = y0)],
      [y1 - p.y, () => (p.y = y1)],
    ];
    exits.reduce((a, e) => (e[0] < a[0] ? e : a))[1]();
  }
  const ground = groundHeight(w, Math.round(p.x * 1000), Math.round(p.z * 1000)) / 1000 + c;
  if (p.y < ground) p.y = ground;
}

/** The camera never moves faster than this (m/s): a little above the dragon's boost speed (52 m/s). */
export const MAX_SPEED = 55;

/**
 * Advances the camera by `dt` seconds toward the target. `stiffness` sets how quickly it catches
 * up (per second); the result is the same for any frame rate.
 */
export function stepRig(rig: RigState, t: RigTarget, dt: number, w: World, lookYaw = 0, lookPitch = 0, stiffness = 5): void {
  const d = desired(t, lookYaw, lookPitch);
  pushOut(d.pos, w);
  if (!rig.ready) {
    rig.pos = { ...d.pos };
    rig.look = { ...d.look };
    rig.ready = true;
    return;
  }
  const k = 1 - Math.exp(-stiffness * Math.max(0, dt));
  const move = { x: (d.pos.x - rig.pos.x) * k, y: (d.pos.y - rig.pos.y) * k, z: (d.pos.z - rig.pos.z) * k };
  const len = Math.hypot(move.x, move.y, move.z);
  const cap = MAX_SPEED * Math.max(0, dt);
  const scale = len > cap ? cap / len : 1;
  for (const key of ["x", "y", "z"] as const) {
    rig.pos[key] += move[key] * scale;
    rig.look[key] += (d.look[key] - rig.look[key]) * Math.min(1, k * 1.6);
  }
  pushOut(rig.pos, w);
}
