import { describe, expect, it } from "vitest";
import { FlightSession } from "../flight/session";
import { NEUTRAL, type InputFrame } from "../world3d/controls";
import { computeFramesInto, samplePathInto, v3 } from "./bodyPath";
import { BODY_LENGTH } from "./dragonBuild";
import { createFollowState, followStep } from "./follow";

const RINGS = 80;

/** Flies a scripted flight at 60 Hz and checks the body after every frame. */
function fly(size: 12 | 20, script: (frame: number) => InputFrame, frames: number) {
  const scale = size / BODY_LENGTH;
  const s = new FlightSession(size);
  const st = createFollowState(BODY_LENGTH);
  const pts = Array.from({ length: RINGS }, () => v3());
  const fr = pts.map(() => ({ t: v3(), n: v3(), b: v3() }));
  let worstHead = 1;
  let worstBend = 0;
  let reversedFrames = 0;
  for (let i = 0; i < frames; i++) {
    s.advance(1000 / 60, script(i));
    const c = s.state;
    const yaw = (c.yaw / 65536) * 2 * Math.PI;
    followStep(st, { x: c.x / 1000 / scale, y: c.y / 1000 / scale, z: c.z / 1000 / scale, yaw, reset: 0 }, BODY_LENGTH);
    samplePathInto(st.path, pts, BODY_LENGTH / (RINGS - 1));
    computeFramesInto(pts, fr);
    if (c.speed < 0) reversedFrames++;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // The head points where the dragon faces (allowing for the slither and turning).
    const th = Math.hypot(fr[0].t.x, fr[0].t.z) || 1;
    const hd = (fr[0].t.x * fx + fr[0].t.z * fz) / th;
    worstHead = Math.min(worstHead, hd);
    // No fold anywhere along the body: neighbouring rings point almost the same way.
    for (let k = 1; k < RINGS; k++) {
      const a = fr[k - 1].t;
      const b = fr[k].t;
      worstBend = Math.max(worstBend, Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))));
    }
  }
  return { worstHead, worstBend: (worstBend * 180) / Math.PI, reversedFrames };
}

describe("dragon body following the flight engine", () => {
  it("flying backwards (and turning) keeps the head facing forward and the body unfolded", () => {
    for (const size of [12, 20] as const) {
      const r = fly(size, (i) => (i < 120 ? NEUTRAL : i < 900 ? { ...NEUTRAL, throttle: -8, turn: i < 500 ? 3 : 0 } : { ...NEUTRAL, throttle: 8 }), 1300);
      expect(r.reversedFrames).toBeGreaterThan(400); // it really flew backwards for a while
      // Before the fix the head ended up facing backwards (−1) and the body folded over.
      expect(r.worstHead).toBeGreaterThan(0.7);
      expect(r.worstBend).toBeLessThan(20);
    }
  });

  it("forward flight with turns, climbs and dives keeps the head forward and the body unfolded", () => {
    const r = fly(12, (i) => ({ ...NEUTRAL, throttle: 6, turn: ((Math.floor(i / 90) * 5) % 17) - 8, up: Math.floor(i / 150) % 3 === 0, down: Math.floor(i / 150) % 3 === 1 }), 2000);
    // Sliding along a pillar can point the nose a little off the line of travel and put a sharp
    // corner in the trail where it bumped, but never a fold (a fold is close to 180°).
    expect(r.worstHead).toBeGreaterThan(0);
    expect(r.worstBend).toBeLessThan(45);
  });
});
