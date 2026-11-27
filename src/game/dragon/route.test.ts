import { describe, expect, it } from "vitest";
import { distance } from "./bodyPath";
import { createRoute, figureEight, slitherAt } from "./route";

describe("showcase route", () => {
  const route = createRoute();

  it("is a closed loop of sensible length", () => {
    expect(route.length).toBeGreaterThan(20);
    expect(route.length).toBeLessThan(35);
    expect(distance(route.at(0), route.at(route.length))).toBeLessThan(1e-9);
    expect(distance(route.at(-1), route.at(route.length - 1))).toBeLessThan(1e-9);
  });

  it("moves the head at constant speed", () => {
    const step = 0.1;
    for (let s = 0; s < route.length; s += 0.37) {
      const d = distance(route.at(s), route.at(s + step));
      expect(d).toBeGreaterThan(step * 0.98);
      expect(d).toBeLessThanOrEqual(step + 1e-6);
    }
  });

  it("passes the crossing at two heights more than a body width apart", () => {
    const high = figureEight(0);
    const low = figureEight(Math.PI);
    expect(Math.hypot(high.x - low.x, high.z - low.z)).toBeLessThan(1e-9);
    expect(high.y - low.y).toBeGreaterThan(0.8); // body diameter is 0.8
    expect(low.y - 0.4 * 0.7).toBeGreaterThan(0); // belly stays above the water
  });

  it("slither stays close to the route and is deterministic", () => {
    for (let s = 0; s < route.length; s += 0.5) {
      expect(distance(slitherAt(route, s), route.at(s))).toBeLessThanOrEqual(0.22 + 1e-9);
      expect(slitherAt(route, s)).toEqual(slitherAt(route, s));
    }
  });
});
