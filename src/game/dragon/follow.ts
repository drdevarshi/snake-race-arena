/**
 * Lays the dragon's body along the path of a head driven from outside (the flight sandbox).
 * Pure maths on the HeadPath trail, so it is tested in Node.
 *
 * Forwards, the head simply leaves a trail and the body follows it. Backwards (or turning on
 * the spot while hovering), the body keeps its shape and moves and turns with the head. So the
 * dragon never folds over itself or ends up facing the wrong way.
 */
import { HeadPath, type Vec3 } from "./bodyPath";

/** Where the head is this frame, in dragon metres; `yaw` in radians (0 faces +z). */
export type FollowTarget = { x: number; y: number; z: number; yaw: number; reset: number };

export type FollowState = { path: HeadPath; reset: number; travelled: number; last: Vec3; lastYaw: number };


/** Gentle side-to-side slither (dragon metres). */
export const WAVE_AMPLITUDE = 0.12;
export const WAVE_LENGTH = 3.5;

export function createFollowState(bodyLength: number): FollowState {
  return { path: new HeadPath(bodyLength + 2, 0.008), reset: Number.NaN, travelled: 0, last: { x: 0, y: 0, z: 0 }, lastYaw: 0 };
}

export function followStep(st: FollowState, t: FollowTarget, bodyLength: number): void {
  const fx = Math.sin(t.yaw);
  const fz = Math.cos(t.yaw);
  let forward = 0;
  const seeded = t.reset !== st.reset;
  if (seeded) {
    // New flight or replay: lay the body out straight behind the head.
    st.reset = t.reset;
    st.travelled = 0;
    st.path.clear();
    for (let d = bodyLength + 1; d >= 0; d -= 0.02) st.path.push({ x: t.x - fx * d, y: t.y, z: t.z - fz * d });
  } else {
    forward = (t.x - st.last.x) * fx + (t.z - st.last.z) * fz;
    // The slither wave advances only when flying forwards.
    if (forward > 0) st.travelled += forward;
  }
  const prevYaw = st.lastYaw;
  const turned = !seeded && t.yaw !== prevYaw;
  st.last = { x: t.x, y: t.y, z: t.z };
  st.lastYaw = t.yaw;
  const wave = WAVE_AMPLITUDE * Math.sin((st.travelled / WAVE_LENGTH) * Math.PI * 2);
  const head = { x: t.x + fz * wave, y: t.y, z: t.z - fx * wave };
  if (forward < -1e-5 || (forward < 1e-5 && turned)) {
    // Backing up, or turning on the spot: the body keeps its shape and moves with the head, turning
    // by the same angle around it (like a stiff body reversing). It can never fold or face backwards;
    // once the dragon flies forwards again the body follows the new trail as usual.
    const from = st.path.sampleBack(0);
    const dyaw = t.yaw - prevYaw;
    const c = Math.cos(dyaw);
    const sn = Math.sin(dyaw);
    const pts: Vec3[] = [];
    for (let d = bodyLength + 1; d > 0; d -= 0.05) {
      const q = st.path.sampleBack(d);
      const rx = q.x - from.x;
      const rz = q.z - from.z;
      // Rotation about the vertical axis that turns heading `prevYaw` into `t.yaw` (x = sin, z = cos).
      pts.push({ x: head.x + rx * c + rz * sn, y: head.y + (q.y - from.y), z: head.z - rx * sn + rz * c });
    }
    st.path.clear();
    for (const q of pts) st.path.push(q);
  }
  st.path.push(head);
}
