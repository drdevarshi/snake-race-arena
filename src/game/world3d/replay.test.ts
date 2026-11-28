import { describe, expect, it } from "vitest";
import { decodeInput, encodeInput, InputRecorder, NEUTRAL, type InputLog } from "./controls";
import { HEAD_RADIUS } from "./flight";
import { hashHex, replay, validateLog } from "./replay";
import { GOLDEN, SCRIPTED_FLIGHTS } from "./scripted";
import { SANDBOX } from "./world";

describe("replay determinism (A4)", () => {
  it.each(SCRIPTED_FLIGHTS.map((f) => [f.name, f] as const))("%s replays to its golden hash, every time", (name, f) => {
    const a = replay(f.log);
    const b = replay(structuredClone(f.log));
    expect(a).toEqual(b);
    expect(a.tick).toBe(3000);
    expect(hashHex(a.hash)).toBe(GOLDEN[name]);
  });

  it("each scripted flight bumps a pillar or the deck", () => {
    for (const f of SCRIPTED_FLIGHTS) {
      const R = HEAD_RADIUS[f.log.size];
      let hit = false;
      replay(f.log, (s) => {
        for (const p of [...SANDBOX.pillars, ...SANDBOX.poles]) if ((s.x - p.x) ** 2 + (s.z - p.z) ** 2 <= (p.r + R + 2) ** 2 && s.y < p.h + R) hit = true;
        const b = SANDBOX.deck;
        if (s.x > b.x0 - R - 2 && s.x < b.x1 + R + 2 && s.z > b.z0 - R - 2 && s.z < b.z1 + R + 2 && s.y > b.y0 - R - 2 && s.y < b.y1 + R + 2) hit = true;
      });
      expect(hit, f.name).toBe(true);
    }
  });

  it("a one-tick change in input changes the hash", () => {
    const f = SCRIPTED_FLIGHTS[0];
    const moved: InputLog = { ...f.log, changes: f.log.changes.map(([t, c], i) => [i === 1 ? t + 1 : t, c] as [number, number]) };
    expect(replay(moved).hash).not.toBe(replay(f.log).hash);
  });
});

describe("input logs", () => {
  it("encodes and decodes every valid input exactly", () => {
    for (let turn = -8; turn <= 8; turn++)
      for (let throttle = -8; throttle <= 8; throttle++)
        for (const up of [false, true])
          for (const down of [false, true])
            for (const boost of [false, true]) {
              const f = { turn, throttle, up, down, boost };
              expect(decodeInput(encodeInput(f))).toEqual(f);
            }
  });

  it("the recorder keeps only changes", () => {
    const r = new InputRecorder();
    r.record(0, NEUTRAL);
    r.record(1, NEUTRAL);
    r.record(2, { ...NEUTRAL, turn: 3 });
    r.record(3, { ...NEUTRAL, turn: 3 });
    r.record(4, NEUTRAL);
    expect(r.changes.map(([t]) => t)).toEqual([0, 2, 4]);
  });

  it("rejects malformed or tampered logs", () => {
    const ok = SCRIPTED_FLIGHTS[0].log;
    expect(() => validateLog(ok)).not.toThrow();
    const bad = (p: Partial<InputLog>) => () => validateLog({ ...ok, ...p } as InputLog);
    expect(bad({ size: 15 as 12 })).toThrow();
    expect(bad({ ticks: 10_000_000 })).toThrow();
    expect(bad({ changes: [[5, 0], [5, 1]] })).toThrow(); // ticks must increase
    expect(bad({ changes: [[0, 99_999]] })).toThrow(); // invalid input code
    expect(bad({ changes: [[0, 7], [3001, 7]] })).toThrow(); // change after the end
    expect(() => encodeInput({ ...NEUTRAL, turn: 9 })).toThrow();
    expect(() => encodeInput({ ...NEUTRAL, turn: 0.5 })).toThrow();
  });
});
