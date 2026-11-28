import { describe, expect, it } from "vitest";
import { NEUTRAL, type InputFrame } from "./controls";
import { createFlight, FLIGHT, stepFlight, type FlightState } from "./flight";
import { SANDBOX } from "./world";

const cfg = { world: SANDBOX, size: 12 as const };
const input = (p: Partial<InputFrame>): InputFrame => ({ ...NEUTRAL, ...p });
/** A flight high above everything, so nothing interferes. */
function openSky(): FlightState {
  const s = createFlight();
  s.y = 100_000;
  return s;
}
function run(s: FlightState, i: InputFrame, ticks: number, each?: (s: FlightState) => void) {
  for (let t = 0; t < ticks; t++) {
    stepFlight(s, i, cfg);
    each?.(s);
  }
}

describe("input response (A5)", () => {
  it.each([
    ["turn right", { turn: 8 }, (a: FlightState, b: FlightState) => a.yaw !== b.yaw && a.bank !== b.bank],
    ["throttle", { throttle: 8 }, (a: FlightState, b: FlightState) => a.speed !== b.speed],
    ["brake", { throttle: -8 }, (a: FlightState, b: FlightState) => a.speed !== b.speed],
    ["climb", { up: true }, (a: FlightState, b: FlightState) => a.vy !== b.vy],
    ["dive", { down: true }, (a: FlightState, b: FlightState) => a.vy !== b.vy],
    ["boost", { boost: true }, (a: FlightState, b: FlightState) => a.speed !== b.speed],
  ] as const)("%s takes effect on the very next 20 ms tick", (_n, p, changed) => {
    const a = openSky();
    const b = openSky();
    stepFlight(a, NEUTRAL, cfg);
    stepFlight(b, input(p), cfg);
    expect(changed(a, b)).toBe(true);
  });

  it("turning right lowers the heading at up to ~90°/s", () => {
    const s = openSky();
    const yaw0 = s.yaw;
    run(s, input({ turn: 8 }), 50);
    const turned = (yaw0 - s.yaw + 65536) % 65536;
    expect(turned).toBeGreaterThan(16_000);
    expect(turned).toBeLessThan(16_800);
  });
});

describe("assisted flight (A6, decision D3)", () => {
  it("after releasing climb and turn, pitch and bank return to level within 1.5 s with no overshoot; speed holds", () => {
    const s = openSky();
    run(s, input({ up: true, turn: 8, throttle: 8 }), 100); // full climb, full right turn
    expect(s.pitch).toBeGreaterThan(0);
    expect(s.bank).toBeLessThan(0);
    const speed = s.speed;
    const pitches: number[] = [];
    const banks: number[] = [];
    run(s, NEUTRAL, 75, (st) => {
      pitches.push(st.pitch);
      banks.push(st.bank);
    }); // 1.5 s
    expect(s.pitch).toBe(0);
    expect(s.bank).toBe(0);
    expect(s.vy).toBe(0);
    expect(s.speed).toBe(speed);
    // Monotonic: never passes level and comes back (no overshoot, no wobble).
    for (let k = 1; k < pitches.length; k++) {
      expect(pitches[k]).toBeLessThanOrEqual(pitches[k - 1]);
      expect(pitches[k]).toBeGreaterThanOrEqual(0);
      expect(banks[k]).toBeGreaterThanOrEqual(banks[k - 1]);
      expect(banks[k]).toBeLessThanOrEqual(0);
    }
  });

  it("the same holds after a dive and a left turn", () => {
    const s = openSky();
    run(s, input({ down: true, turn: -8 }), 60);
    run(s, NEUTRAL, 75);
    expect([s.pitch, s.bank, s.vy]).toEqual([0, 0, 0]);
  });

  it("any input takes over at once during levelling out", () => {
    const s = openSky();
    run(s, input({ up: true }), 40);
    run(s, NEUTRAL, 10);
    const before = s.vy;
    stepFlight(s, input({ up: true }), cfg);
    expect(s.vy).toBeGreaterThan(before);
  });
});

describe("speed rules", () => {
  it("full forward reaches 40 m/s, back reaches −5 m/s, boost 52 m/s, release holds", () => {
    const s = openSky();
    run(s, input({ throttle: 8 }), 200);
    expect(s.speed).toBe(FLIGHT.max);
    run(s, NEUTRAL, 50);
    expect(s.speed).toBe(FLIGHT.max);
    run(s, input({ boost: true }), 100);
    expect(s.speed).toBe(FLIGHT.boostMax);
    run(s, input({ throttle: -8 }), 300);
    expect(s.speed).toBe(FLIGHT.reverse);
  });
});
