import { describe, expect, it } from "vitest";
import { NEUTRAL, type InputFrame } from "../world3d/controls";
import { replay } from "../world3d/replay";
import { axis, frameFrom, NO_TOUCH } from "./input";
import { FlightSession, REPLAY_TICKS, resimulate } from "./session";

/** A varied, repeatable input pattern (changes every 37 ticks). */
function pattern(t: number): InputFrame {
  const k = Math.floor(t / 37);
  return { turn: ((k * 5) % 17) - 8, throttle: ((k * 3) % 17) - 8, up: k % 4 === 1, down: k % 5 === 2, boost: k % 7 === 3 };
}

describe("flight session", () => {
  it("runs whole 20 ms ticks whatever the frame rate, and the interpolation factor stays in 0–1", () => {
    const a = new FlightSession(12);
    const b = new FlightSession(12);
    for (let i = 0; i < 600; i++) a.advance(1000 / 60, NEUTRAL); // 10 s at 60 Hz
    for (let i = 0; i < 1200; i++) {
      const alpha = b.advance(1000 / 120, NEUTRAL); // 10 s at 120 Hz
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
    expect(Math.abs(a.state.tick - 500)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.state.tick - 500)).toBeLessThanOrEqual(1);
  });

  it("skips a long stall instead of fast-forwarding through it", () => {
    const s = new FlightSession(12);
    s.advance(5000, NEUTRAL);
    expect(s.state.tick).toBe(5);
  });

  it("input takes effect on the next tick (A5)", () => {
    const s = new FlightSession(12);
    for (let i = 0; i < 10; i++) s.tick(NEUTRAL);
    const yaw = s.state.yaw;
    s.tick({ ...NEUTRAL, turn: 8 });
    expect(s.state.yaw).not.toBe(yaw);
  });

  it("its recorded log replays from the start to exactly the same hash (A4)", () => {
    for (const size of [12, 20] as const) {
      const s = new FlightSession(size);
      for (let t = 0; t < 4000; t++) s.tick(pattern(t));
      const r = replay(s.log());
      expect(r).toEqual(s.state);
    }
  });

  it("“Replay last 60 s” starts at least 60 s back and ends on the live hash", () => {
    const s = new FlightSession(20);
    for (let t = 0; t < 7777; t++) s.tick(pattern(t));
    const m = s.lastMinute();
    expect(s.state.tick - m.from.tick).toBeGreaterThanOrEqual(REPLAY_TICKS);
    expect(s.state.tick - m.from.tick).toBeLessThan(REPLAY_TICKS + 500);
    let ticks = 0;
    const end = resimulate(m.from, m.changes, m.to, s.size, () => ticks++);
    expect(ticks).toBe(s.state.tick - m.from.tick);
    expect(end).toEqual(s.state);
  });

  it("a short flight replays from the start", () => {
    const s = new FlightSession(12);
    for (let t = 0; t < 900; t++) s.tick(pattern(t));
    const m = s.lastMinute();
    expect(m.from.tick).toBe(0);
    expect(resimulate(m.from, m.changes, m.to, 12)).toEqual(s.state);
  });
});

describe("controls mapping", () => {
  it("keys give full-scale axes and the buttons", () => {
    expect(frameFrom(new Set(["KeyW", "KeyD", "Space"]), NO_TOUCH)).toEqual({ turn: 8, throttle: 8, up: true, down: false, boost: false });
    expect(frameFrom(new Set(["ArrowDown", "ArrowLeft", "ShiftLeft", "KeyE"]), NO_TOUCH)).toEqual({ turn: -8, throttle: -8, up: false, down: true, boost: true });
    expect(frameFrom(new Set(["KeyA", "KeyD"]), NO_TOUCH)).toEqual(NEUTRAL);
  });

  it("joystick and Up/Down buttons work at the same time (A9)", () => {
    const f = frameFrom(new Set(), { stickX: 0.5, stickY: 1, up: true, down: false, boost: true });
    expect(f.turn).toBe(3); // half-way, after the dead zone
    expect(f.throttle).toBe(8);
    expect(f.up && f.boost).toBe(true);
  });

  it("joystick axes have a dead zone, stay in −8…8, and are never -0", () => {
    expect(axis(0.05)).toBe(0);
    expect(Object.is(axis(-0.05), 0)).toBe(true);
    expect(axis(1)).toBe(8);
    expect(axis(-3)).toBe(-8);
    expect(axis(Number.NaN)).toBe(0);
    for (let v = -1; v <= 1; v += 0.01) {
      const a = axis(v);
      expect(Number.isInteger(a) && a >= -8 && a <= 8 && !Object.is(a, -0)).toBe(true);
    }
  });
});

describe("playback", () => {
  it("plays the last minute back in real time and ends on the live hash", async () => {
    const { Playback } = await import("./session");
    const s = new FlightSession(12);
    for (let t = 0; t < 5000; t++) s.tick(pattern(t));
    const m = s.lastMinute();
    const p = new Playback(m.from, m.changes, m.to, s.size, s.state.hash);
    let frames = 0;
    while (!p.done && frames < 100_000) {
      const a = p.advance(1000 / 60);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      frames++;
    }
    expect(p.matches).toBe(true);
    expect(p.state).toEqual(s.state);
    // About 60–70 s of frames at 60 Hz.
    expect(frames).toBeGreaterThan(3500);
    expect(frames).toBeLessThan(4300);
    // A wrong expected hash is reported as a mismatch.
    const bad = new Playback(m.from, m.changes, m.to, s.size, s.state.hash ^ 1);
    while (!bad.done) bad.advance(100);
    expect(bad.matches).toBe(false);
  });
});
