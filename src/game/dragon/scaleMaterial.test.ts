import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./scaleMaterial.ts", import.meta.url)), "utf8");

/** GLSL smoothstep as the spec defines it for edge0 < edge1. */
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

describe("scale shader", () => {
  it("never calls smoothstep with reversed or equal literal edges (undefined in GLSL)", () => {
    const calls = [...source.matchAll(/smoothstep\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,/g)];
    expect(calls.length).toBeGreaterThan(5);
    for (const [, e0, e1] of calls) expect(Number(e0), `smoothstep(${e0}, ${e1}, …)`).toBeLessThan(Number(e1));
  });

  it("the head belly mask keeps the curve the old reversed call was meant to give", () => {
    for (let y = -1; y <= 1.0001; y += 0.01) {
      // Intended meaning of smoothstep(-0.25, -0.6, y): 0 above -0.25, 1 below -0.6, smooth between.
      const s = Math.min(1, Math.max(0, (y + 0.25) / (-0.6 + 0.25)));
      const intended = s * s * (3 - 2 * s);
      expect(1 - smoothstep(-0.6, -0.25, y)).toBeCloseTo(intended, 12);
    }
  });
});
