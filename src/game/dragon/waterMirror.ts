import { Color, PlaneGeometry } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/**
 * High-quality water floor: a real mirror from three.js (no extra package), dimmed by a tint so it
 * reads as dark water rather than glass. Replaces drei's MeshReflectorMaterial, which never
 * releases its render targets when it unmounts (5 textures leaked per quality switch, 26 Nov).
 */
export type WaterMirror = { mirror: Reflector; dispose: () => void };

export function createWaterMirror(size: number, resolution: number): WaterMirror {
  const geometry = new PlaneGeometry(size, size);
  const mirror = new Reflector(geometry, {
    textureWidth: resolution,
    textureHeight: resolution,
    color: new Color("#3b3b4a"),
    clipBias: 0.003,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.name = "WaterMirror";
  return {
    mirror,
    dispose: () => {
      mirror.removeFromParent();
      mirror.dispose(); // render target + material
      geometry.dispose();
    },
  };
}
