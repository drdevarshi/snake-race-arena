import { describe, expect, it } from "vitest";
import { Mesh, Vector3 } from "three";
import { ENVELOPE_RADIUS, HEAD_AHEAD, PORTRAIT_FOV, allInView, cameraAt, fitDistance, portraitPlacement, routeEnvelope } from "./cameraFit";
import { build, MAX_RADIUS } from "./dragonBuild";

/** Portrait canvas shapes: narrow phone, iPhone 13 class (≈0.76), larger phones, near-square. */
const ASPECTS = [0.5, 0.6, 0.7, 0.76, 0.85, 0.95];

describe("portrait camera framing", () => {
  it("the envelope covers the real dragon: head, horns, whiskers and body", () => {
    const b = build("neon-magenta", "high");
    const root = b.head.root;
    root.updateMatrixWorld(true);
    let reach = 0;
    let ahead = 0;
    const v = new Vector3();
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        ahead = Math.max(ahead, v.z);
        const zc = Math.min(Math.max(v.z, 0), HEAD_AHEAD);
        reach = Math.max(reach, Math.hypot(v.x, v.y, v.z - zc));
      }
    });
    b.dispose();
    expect(ahead).toBeLessThanOrEqual(HEAD_AHEAD);
    expect(reach).toBeLessThanOrEqual(ENVELOPE_RADIUS);
    expect(MAX_RADIUS * 2).toBeLessThanOrEqual(ENVELOPE_RADIUS); // crest included
  });

  it.each(ASPECTS)("keeps everything the dragon can reach in view at aspect %s", (aspect) => {
    const fit = portraitPlacement(aspect);
    expect(fit.fov).toBe(PORTRAIT_FOV);
    expect(allInView(routeEnvelope(0.1), ENVELOPE_RADIUS, fit.position, fit.fov, aspect)).toBe(true);
    // ...and it is the closest such camera in that direction: 5% closer would clip.
    expect(allInView(routeEnvelope(0.1), ENVELOPE_RADIUS, cameraAt(fit.azimuth, fit.distance * 0.95), fit.fov, aspect)).toBe(false);
  });

  it("does not zoom out more than needed: it beats the side-on view by a wide margin", () => {
    for (const aspect of ASPECTS) {
      const fit = portraitPlacement(aspect);
      expect(fit.distance).toBeLessThan(fitDistance(0, PORTRAIT_FOV, aspect) * 0.8);
      expect(fit.distance).toBeLessThan(25);
    }
  });

  it("the previous rule of thumb clipped the dragon on a typical iPhone (regression)", () => {
    const aspect = 0.76;
    const old = 10.1 * Math.pow(1.3 / aspect, 0.45); // the portrait rule before this fix, at 58°
    const dir = cameraAt(0, old);
    expect(allInView(routeEnvelope(0.1), ENVELOPE_RADIUS, dir, 58, aspect)).toBe(false);
  });

  it("is deterministic", () => {
    expect(portraitPlacement(0.76)).toEqual(portraitPlacement(0.76));
  });
});
