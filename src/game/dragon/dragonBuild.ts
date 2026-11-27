import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  type ShaderMaterial,
} from "three";
import { createBodyGeometry } from "./bodyGeometry";
import { radiusProfile, v3, type Frame, type Vec3 } from "./bodyPath";
import { buildPrototypeHead, type PrototypeHead } from "./prototypeHead";
import { createCountedTracker } from "./resources";
import { createScaleMaterial } from "./scaleMaterial";
import { SKINS, type SkinId } from "./skins";
import { QUALITY, type Quality } from "./quality";

/**
 * Builds and owns the dragon's GPU resources for one quality tier. Kept free of React and JSX so
 * its ownership rules can be unit-tested in Node.
 */

/** Body radius at its thickest point (metres). */
export const MAX_RADIUS = 0.4;
/** Body length from neck to tail tip (metres). Fixed, as in competitive modes. */
export const BODY_LENGTH = 7.8;
/** Scale rows per metre along the body. */
const SCALES_ALONG = 3.6;
/** Scales around the body. */
const SCALES_AROUND = 9;

/** Crystal back-ridge blade: a flattened shard leaning back, base on the spine. */
function createBladeGeometry(): BufferGeometry {
  // A front, B back, C/D sides, T tip (leaning towards the tail, -Z).
  const v = [
    [0, 0, 0.6],
    [0, 0, -0.45],
    [0.13, 0.08, 0],
    [-0.13, 0.08, 0],
    [0, 1, -0.6],
  ];
  const faces = [
    [0, 2, 4],
    [2, 1, 4],
    [1, 3, 4],
    [3, 0, 4],
  ];
  const pos: number[] = [];
  for (const f of faces) for (const i of f) pos.push(...v[i]);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals(); // non-indexed → flat crystal facets
  return g;
}

/** Tail fin: a leaf shape standing upright, trailing behind the tail tip. */
function createFinGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.35, 0.18, 0.75, 0.22, 1.05, 0);
  s.bezierCurveTo(0.75, -0.2, 0.35, -0.16, 0, 0);
  const g = new ShapeGeometry(s, 12);
  // Shape lies in XY with length along +X; stand it in the YZ plane trailing along -Z.
  g.rotateY(Math.PI / 2);
  return g;
}

export type Built = {
  body: Mesh;
  bodyMat: ShaderMaterial;
  ridges: InstancedMesh;
  ridgeRings: number[];
  fin: Mesh;
  head: PrototypeHead;
  crystals: MeshStandardMaterial[];
  /** Reused every frame so the body update allocates nothing. */
  work: { pts: Vec3[]; frames: Frame[]; radii: number[] };
  dispose: () => void;
};

export function build(skinId: SkinId, quality: Quality): Built {
  const q = QUALITY[quality];
  const skin = SKINS[skinId];
  const tracker = createCountedTracker();
  const spacing = BODY_LENGTH / (q.rings - 1);

  const bodyGeo = tracker.track(createBodyGeometry(q.rings, spacing, 1));
  const bodyMat = tracker.track(createScaleMaterial({ skin, repeat: [SCALES_AROUND, SCALES_ALONG], useAlong: true }));
  const body = new Mesh(bodyGeo, bodyMat);
  body.frustumCulled = false;

  const crystal = tracker.track(
    new MeshStandardMaterial({ color: new Color(skin.body), emissive: new Color(skin.glow), emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.15, flatShading: true }),
  );
  const finMat = tracker.track(crystal.clone());
  finMat.side = DoubleSide;
  finMat.emissiveIntensity = 1.3;

  // Ridges along the spine, from just behind the neck to about 88% of the body.
  const ridgeRings: number[] = [];
  const first = Math.round(q.rings * 0.03);
  const last = Math.round(q.rings * 0.88);
  const step = (last - first) / (q.ridges - 1);
  for (let k = 0; k < q.ridges; k++) ridgeRings.push(Math.round(first + k * step));
  const ridges = new InstancedMesh(tracker.track(createBladeGeometry()), crystal, q.ridges);
  ridges.frustumCulled = false;

  const fin = new Mesh(tracker.track(createFinGeometry()), finMat);
  fin.frustumCulled = false;

  const head = buildPrototypeHead(skin, MAX_RADIUS * radiusProfile(0), tracker.track);

  return {
    body,
    bodyMat,
    ridges,
    ridgeRings,
    fin,
    head,
    crystals: [crystal, finMat, head.crystal],
    work: {
      pts: Array.from({ length: q.rings }, () => v3()),
      frames: Array.from({ length: q.rings }, () => ({ t: v3(), n: v3(), b: v3() })),
      radii: Array.from({ length: q.rings }, (_, i) => MAX_RADIUS * radiusProfile(i / (q.rings - 1))),
    },
    dispose: () => {
      // Detach first: a disposed geometry that is still in the scene gets re-uploaded on the next
      // frame and is then never freed (the leak found on 26 Nov when switching quality).
      for (const o of [body, ridges, fin, head.root]) o.removeFromParent();
      tracker.disposeAll();
    },
  };
}

