import { describe, expect, it } from "vitest";
import { Group } from "three";
import { build } from "./dragonBuild";
import { liveResources } from "./resources";
import { QUALITY_ORDER } from "./quality";

describe("Dragon build ownership (TB-2)", () => {
  it("detaches every object from the scene before disposing, so nothing can be re-uploaded", () => {
    const start = liveResources.count;
    for (let cycle = 0; cycle < 20; cycle++) {
      for (const q of QUALITY_ORDER) {
        const scene = new Group();
        const b = build("neon-magenta", q);
        scene.add(b.body, b.ridges, b.fin, b.head.root);
        expect(liveResources.count).toBeGreaterThan(start);
        b.dispose();
        expect(scene.children).toHaveLength(0);
        expect(liveResources.count).toBe(start);
      }
    }
  });
});
