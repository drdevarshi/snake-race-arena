import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL(".", import.meta.url));
const engineFiles = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** Source with comments removed, so explanations that mention Math.sin don't count. */
const code = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FORBIDDEN: [RegExp, string][] = [
  [/Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|sqrt|cbrt|pow|exp|expm1|log|log2|log10|log1p|hypot|fround|round|random)\b/, "floating-point Math function"],
  [/\bDate\b/, "clock (Date)"],
  [/performance\s*\.\s*now/, "clock (performance.now)"],
  [/requestAnimationFrame|setTimeout|setInterval/, "timing API"],
  [/Float(32|64)Array/, "float array"],
  [/\b(window|document|navigator|localStorage)\b/, "browser API"],
  [/from\s+["'](three|react|@react-three)/, "rendering library import"],
];

describe("world engine purity (A3)", () => {
  it("covers the engine files", () => {
    expect(engineFiles).toEqual(expect.arrayContaining(["fixed.ts", "tables.ts", "controls.ts", "world.ts", "flight.ts", "collide.ts", "replay.ts"]));
  });

  it.each(engineFiles)("%s uses no floating-point maths, clock, randomness or browser APIs", (f) => {
    const src = code(f);
    for (const [re, what] of FORBIDDEN) expect(re.test(src), `${f}: ${what}`).toBe(false);
  });

  it("the scan itself catches a forbidden call", () => {
    expect(FORBIDDEN[0][0].test("const a = Math.sin(x);")).toBe(true);
    expect(FORBIDDEN[1][0].test("Date.now()")).toBe(true);
  });
});
