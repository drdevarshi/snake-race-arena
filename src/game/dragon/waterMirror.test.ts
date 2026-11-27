import { describe, expect, it, vi } from "vitest";
import { Group } from "three";
import { createWaterMirror } from "./waterMirror";

describe("water mirror ownership", () => {
  it("releases its render target, material and geometry, and leaves the scene", () => {
    const scene = new Group();
    const w = createWaterMirror(70, 512);
    scene.add(w.mirror);
    const rt = w.mirror.getRenderTarget();
    const spies = [vi.spyOn(rt, "dispose"), vi.spyOn(w.mirror.material as { dispose: () => void }, "dispose"), vi.spyOn(w.mirror.geometry, "dispose")];
    w.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
  });
});
