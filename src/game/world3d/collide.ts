/**
 * Sandbox collision for the dragon's head (a sphere of `radius` mm). Bump and slide, never stuck:
 * the head is pushed out of any solid along the shortest way, and when it is heading into a wall
 * its heading is turned toward the wall's direction so it slides along instead of stopping.
 * Integers only.
 */
import { atan2Q, idiv, isqrt, signedAngle, wrapAngle } from "./fixed";
import type { FlightState } from "./flight";
import { groundHeight, type Box, type Pillar, type World } from "./world";

/**
 * How fast the heading turns toward the wall's surface when pushing into it (angle units per tick
 * ≈ 110°/s). Faster than the fastest player turn (328), so the dragon always slides along a wall,
 * even while steering into it, instead of being pinned against it.
 */
const DEFLECT = 400;
/** How fast the heading turns back toward the centre beyond the soft edge (≈ 110°/s, faster than any player turn). */
const EDGE_STEER = 400;

/**
 * Turns the heading toward the wall's tangent if it points into the wall. `outYaw` is the heading
 * pointing straight out of the wall.
 */
function deflect(s: FlightState, outYaw: number): void {
  const diff = signedAngle(s.yaw - outYaw); // 0 = flying straight out, ±32,768 = straight in
  if (diff > 16_384 || diff < -16_384) {
    // Reduce |diff| toward 90° (along the wall), without passing it.
    const dir = diff >= 0 ? 1 : -1;
    const room = Math.abs(diff) - 16_384;
    s.yaw = wrapAngle(s.yaw - dir * Math.min(DEFLECT, room));
  }
}

function pillar(s: FlightState, p: Pillar, radius: number): boolean {
  const rr = p.r + radius;
  const dx = s.x - p.x;
  const dz = s.z - p.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr || s.y >= p.h + radius) return false;
  const d = isqrt(d2);
  const fromTop = p.h + radius - s.y;
  if (fromTop < rr - d) {
    // Landing on the top is the shorter way out.
    s.y = p.h + radius;
    if (s.vy < 0) s.vy = 0;
    return true;
  }
  if (d === 0) {
    s.x = p.x + rr;
  } else {
    s.x = p.x + idiv(dx * rr, d);
    s.z = p.z + idiv(dz * rr, d);
    // Rounding toward zero can leave the head a hair inside; step out by one millimetre if so.
    const ex = s.x - p.x;
    const ez = s.z - p.z;
    if (ex * ex + ez * ez < rr * rr) {
      s.x += ex > 0 ? 1 : ex < 0 ? -1 : 0;
      s.z += ez > 0 ? 1 : ez < 0 ? -1 : 0;
    }
  }
  deflect(s, atan2Q(dx, dz));
  return true;
}

function box(s: FlightState, b: Box, radius: number): boolean {
  const x0 = b.x0 - radius;
  const x1 = b.x1 + radius;
  const z0 = b.z0 - radius;
  const z1 = b.z1 + radius;
  const y0 = b.y0 - radius;
  const y1 = b.y1 + radius;
  if (s.x <= x0 || s.x >= x1 || s.z <= z0 || s.z >= z1 || s.y <= y0 || s.y >= y1) return false;
  // Push out along the axis with the smallest overlap.
  const pen = [s.x - x0, x1 - s.x, s.z - z0, z1 - s.z, s.y - y0, y1 - s.y];
  let k = 0;
  for (let i = 1; i < 6; i++) if (pen[i] < pen[k]) k = i;
  switch (k) {
    case 0:
      s.x = x0;
      deflect(s, 49_152); // out toward −x
      break;
    case 1:
      s.x = x1;
      deflect(s, 16_384); // out toward +x
      break;
    case 2:
      s.z = z0;
      deflect(s, 32_768); // out toward −z
      break;
    case 3:
      s.z = z1;
      deflect(s, 0); // out toward +z
      break;
    case 4:
      s.y = y0; // under the deck
      if (s.vy > 0) s.vy = 0;
      break;
    default:
      s.y = y1; // on top of the deck
      if (s.vy < 0) s.vy = 0;
  }
  return true;
}

/** Resolves all contacts for this tick. Returns true when the dragon touched anything solid. */
export function resolveCollisions(s: FlightState, w: World, radius: number): boolean {
  let touched = false;

  for (const p of w.pillars) touched = pillar(s, p, radius) || touched;
  for (const p of w.poles) touched = pillar(s, p, radius) || touched;
  touched = box(s, w.deck, radius) || touched;

  // Ground (floor and hill) last, so nothing above can push the head into it.
  const ground = groundHeight(w, s.x, s.z) + radius;
  if (s.y < ground) {
    s.y = ground;
    if (s.vy < 0) s.vy = 0;
    touched = true;
  }
  if (s.y > w.ceiling) {
    s.y = w.ceiling;
    if (s.vy > 0) s.vy = 0;
  }

  // World edge: steer back beyond the soft edge, clamp at the hard edge.
  if (Math.abs(s.x) > w.edge || Math.abs(s.z) > w.edge) {
    const home = atan2Q(-s.x, -s.z);
    const diff = signedAngle(home - s.yaw);
    if (diff !== 0) s.yaw = wrapAngle(s.yaw + (diff > 0 ? Math.min(EDGE_STEER, diff) : Math.max(-EDGE_STEER, diff)));
    // The hard edge acts like a wall: clamp, and slide along it. Correcting toward home (rather
    // than each wall separately) keeps corners from pinning the dragon between two walls.
    const cx = Math.max(-w.hardEdge, Math.min(w.hardEdge, s.x));
    const cz = Math.max(-w.hardEdge, Math.min(w.hardEdge, s.z));
    if (cx !== s.x || cz !== s.z) {
      s.x = cx;
      s.z = cz;
      deflect(s, home);
    }
  }
  return touched;
}
