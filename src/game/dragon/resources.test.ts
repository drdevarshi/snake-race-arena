import { describe, expect, it } from "vitest";
import { createCountedTracker, createResourceTracker, liveResources } from "./resources";

const fake = (log: string[], name: string, fail = false) => ({
  dispose: () => {
    log.push(name);
    if (fail) throw new Error(`fail ${name}`);
  },
});

describe("resource tracker (TB-2 ownership)", () => {
  it("disposes every resource exactly once, newest first", () => {
    const log: string[] = [];
    const t = createResourceTracker();
    const a = t.track(fake(log, "a"));
    t.track(fake(log, "b"));
    t.track(a); // tracking twice must not dispose twice
    expect(t.size).toBe(2);
    t.disposeAll();
    t.disposeAll();
    expect(log).toEqual(["b", "a"]);
    expect(t.size).toBe(0);
  });

  it("keeps disposing after a failure and then reports it", () => {
    const log: string[] = [];
    const t = createResourceTracker();
    t.track(fake(log, "a"));
    t.track(fake(log, "b", true));
    t.track(fake(log, "c"));
    expect(() => t.disposeAll()).toThrow("fail b");
    expect(log).toEqual(["c", "b", "a"]);
    expect(t.size).toBe(0);
  });

  it("returns the live count to zero after 20 mount/unmount cycles", () => {
    const start = liveResources.count;
    for (let visit = 0; visit < 20; visit++) {
      const t = createCountedTracker();
      for (let i = 0; i < 12; i++) t.track({ dispose() {} });
      expect(liveResources.count).toBe(start + 12);
      t.disposeAll();
      expect(liveResources.count).toBe(start);
    }
  });
});
