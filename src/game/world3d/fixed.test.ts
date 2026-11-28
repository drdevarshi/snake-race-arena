import { describe, expect, it } from "vitest";
import { ONE, TURN, atan2Q, cosQ, isqrt, signedAngle, sinQ, wrapAngle } from "./fixed";

describe("fixed-point trigonometry (A2)", () => {
  it("sinQ and cosQ are within 1/10,000 of Math.sin/Math.cos for every angle of the circle", () => {
    let worst = 0;
    for (let a = 0; a < TURN; a++) {
      const r = (a / TURN) * 2 * Math.PI;
      worst = Math.max(worst, Math.abs(sinQ(a) / ONE - Math.sin(r)), Math.abs(cosQ(a) / ONE - Math.cos(r)));
    }
    expect(worst).toBeLessThan(1 / 10000);
  });

  it("hits exact values at the quarter turns and wraps negative angles", () => {
    expect([sinQ(0), sinQ(16384), sinQ(32768), sinQ(49152)]).toEqual([0, ONE, 0, -ONE]);
    expect(sinQ(-16384)).toBe(-ONE);
    expect(sinQ(TURN + 100)).toBe(sinQ(100));
    expect(wrapAngle(-1)).toBe(TURN - 1);
    expect(signedAngle(TURN - 10)).toBe(-10);
  });

  it("atan2Q is within 0.03° of Math.atan2 over many directions and magnitudes", () => {
    let worst = 0;
    for (let i = 0; i < 20000; i++) {
      const ang = (i / 20000) * 2 * Math.PI;
      const mag = [3, 1000, 250_000, 3_000_000][i % 4];
      const x = Math.round(Math.cos(ang) * mag);
      const y = Math.round(Math.sin(ang) * mag);
      if (x === 0 && y === 0) continue;
      const expected = wrapAngle(Math.round((Math.atan2(y, x) / (2 * Math.PI)) * TURN));
      worst = Math.max(worst, Math.abs(signedAngle(atan2Q(y, x) - expected)));
    }
    expect(worst).toBeLessThanOrEqual(6); // 6/65,536 of a turn ≈ 0.033°
    expect(atan2Q(0, 0)).toBe(0);
  });
});

describe("integer square root (A2)", () => {
  it("is exact: r² ≤ n < (r+1)² on sampled values up to 2^52", () => {
    const samples = [0, 1, 2, 3, 4, 15, 16, 17, 99, 100, 101, 2 ** 31 - 1, 2 ** 32, 2 ** 40 + 12345, 2 ** 52 - 1, 2 ** 52];
    for (let i = 0; i < 5000; i++) samples.push((i * 2654435761) % 2 ** 46);
    for (let k = 1; k < 3000; k++) samples.push(k * k - 1, k * k, k * k + 1);
    for (const n of samples) {
      const r = isqrt(n);
      expect(r * r <= n && (r + 1) * (r + 1) > n, `isqrt(${n}) = ${r}`).toBe(true);
    }
  });

  it("rejects inputs outside its exact range", () => {
    expect(() => isqrt(-1)).toThrow();
    expect(() => isqrt(2 ** 52 + 2)).toThrow();
    expect(() => isqrt(1.5)).toThrow();
  });
});
