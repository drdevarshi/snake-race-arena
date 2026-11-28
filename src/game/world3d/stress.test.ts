import { describe, expect, it } from "vitest";
import { NEUTRAL, type InputFrame } from "./controls";
import { createFlight, HEAD_RADIUS, stepFlight } from "./flight";
import { groundHeight, SANDBOX } from "./world";
import { createRig, stepRig } from "../flight/cameraRig";

/** Small seeded generator for test inputs only (the engine itself never uses randomness). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLIGHTS = 10_000;
const TICKS = 1500; // 30 s

describe("collision stress (A7) and camera (A8)", () => {
  it(
    `${FLIGHTS.toLocaleString("en")} random 30 s flights never pass through the floor, pillars, poles, deck or world edge, and never get stuck; the camera never enters a solid or jumps`,
    () => {
      const w = SANDBOX;
      const solids = [...w.pillars, ...w.poles];
      let violations = 0;
      let stuck = 0;
      let camInside = 0;
      let maxCamStep = 0;
      let maxCamDist = 0;
      const examples: string[] = [];
      for (let f = 0; f < FLIGHTS; f++) {
        const r = rng(f + 1);
        const size: 12 | 20 = f % 2 === 0 ? 12 : 20;
        const R = HEAD_RADIUS[size];
        const cfg = { world: w, size };
        const s = createFlight(w);
        // Start each flight somewhere different, aimed somewhere different.
        s.x = Math.floor((r() - 0.5) * 300_000);
        s.z = Math.floor((r() - 0.5) * 300_000);
        s.y = 2_000 + Math.floor(r() * 50_000);
        s.yaw = Math.floor(r() * 65536);
        let input: InputFrame = NEUTRAL;
        let nextChange = 0;
        let windowStart = { x: s.x, y: s.y, z: s.z, tick: 0, pushing: false };
        const rig = createRig();
        for (let t = 0; t < TICKS; t++) {
          if (t === nextChange) {
            input = {
              turn: Math.floor(r() * 17) - 8,
              throttle: r() < 0.7 ? Math.floor(r() * 9) : -Math.floor(r() * 9),
              up: r() < 0.3,
              down: r() < 0.3,
              boost: r() < 0.1,
            };
            nextChange = t + 10 + Math.floor(r() * 90);
          }
          stepFlight(s, input, cfg);
          // Every state field is a finite integer and never -0.
          for (const v of [s.x, s.y, s.z, s.yaw, s.pitch, s.bank, s.speed, s.vy]) {
            if (!Number.isInteger(v) || Object.is(v, -0)) violations++;
          }
          // Outside every solid.
          for (const p of solids) {
            const rr = p.r + R;
            if ((s.x - p.x) ** 2 + (s.z - p.z) ** 2 < rr * rr && s.y < p.h + R) violations++;
          }
          const b = w.deck;
          if (s.x > b.x0 - R && s.x < b.x1 + R && s.z > b.z0 - R && s.z < b.z1 + R && s.y > b.y0 - R && s.y < b.y1 + R) violations++;
          if (s.y < groundHeight(w, s.x, s.z) + R) violations++;
          if (Math.abs(s.x) > w.hardEdge || Math.abs(s.z) > w.hardEdge || s.y > w.ceiling) violations++;
          if (violations && examples.length < 3) examples.push(`flight ${f} tick ${t}: (${s.x}, ${s.y}, ${s.z})`);
          // Camera (A8): same flights, one 20 ms step per tick.
          const before = { ...rig.pos };
          stepRig(rig, { head: { x: s.x / 1000, y: s.y / 1000, z: s.z / 1000 }, yaw: (s.yaw / 65536) * 2 * Math.PI, pitch: (s.pitch / 65536) * 2 * Math.PI, size }, 0.02, w);
          if (t > 0) maxCamStep = Math.max(maxCamStep, Math.hypot(rig.pos.x - before.x, rig.pos.y - before.y, rig.pos.z - before.z));
          if (t > 0) maxCamDist = Math.max(maxCamDist, Math.hypot(rig.pos.x - s.x / 1000, rig.pos.y - s.y / 1000, rig.pos.z - s.z / 1000));
          for (const p of solids) {
            if ((rig.pos.x - p.x / 1000) ** 2 + (rig.pos.z - p.z / 1000) ** 2 < (p.r / 1000) ** 2 && rig.pos.y < p.h / 1000) camInside++;
          }
          if (rig.pos.x > b.x0 / 1000 && rig.pos.x < b.x1 / 1000 && rig.pos.z > b.z0 / 1000 && rig.pos.z < b.z1 / 1000 && rig.pos.y > b.y0 / 1000 && rig.pos.y < b.y1 / 1000) camInside++;
          if (rig.pos.y < groundHeight(w, Math.round(rig.pos.x * 1000), Math.round(rig.pos.z * 1000)) / 1000) camInside++;
          // Not stuck: while pushing forward at ≥ 10 m/s for a whole second, the head moves ≥ 1 m.
          const pushing = input.throttle > 0 && s.speed >= 200;
          if (!pushing) windowStart = { x: s.x, y: s.y, z: s.z, tick: t, pushing: false };
          else if (!windowStart.pushing) windowStart = { x: s.x, y: s.y, z: s.z, tick: t, pushing: true };
          else if (t - windowStart.tick >= 50) {
            const moved = (s.x - windowStart.x) ** 2 + (s.y - windowStart.y) ** 2 + (s.z - windowStart.z) ** 2;
            if (moved < 1_000_000) {
              stuck++;
              if (examples.length < 3) examples.push(`stuck: flight ${f} tick ${t}`);
            }
            windowStart = { x: s.x, y: s.y, z: s.z, tick: t, pushing: true };
          }
        }
      }
      console.log(`camera: largest move in one 20 ms tick ${maxCamStep.toFixed(2)} m; furthest from the head ${maxCamDist.toFixed(1)} m`);
      expect({ violations, stuck, examples, camInside }).toEqual({ violations: 0, stuck: 0, examples: [], camInside: 0 });
      // No sudden jumps: the fastest the dragon itself can move is 1.04 m per tick (52 m/s).
      expect(maxCamStep).toBeLessThan(2);
      // Never left behind (e.g. trapped behind a pillar): normal distance is 20 m (12 m dragon) to 34 m (20 m).
      expect(maxCamDist).toBeLessThan(90);
    },
    300_000,
  );
});
