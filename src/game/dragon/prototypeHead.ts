import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { ResourceTracker } from "./resources";
import { applySkin as applyScaleSkin, createScaleMaterial } from "./scaleMaterial";
import type { Skin } from "./skins";

/**
 * Temporary dragon head, built in code to the head asset contract (Phase 0 report, section 4):
 * metres, facing +Z, up +Y, origin at the neck joint; named parts Head, Jaw, Eye_L, Eye_R, Horns,
 * Whisker_L, Whisker_R, NeckSocket; jaw opens 0–35°. A real head.glb can replace it later.
 *
 * The skull and jaw are lofted cross-sections (like the body), so the scale pattern continues
 * seamlessly from the body onto the head.
 */

type Key = { z: number; w: number; top: number; bot: number; p: number };

/** Smooth interpolation through keyframes (piecewise smoothstep, flat at each key). */
function sampleKeys(keys: Key[], z: number): Key {
  if (z <= keys[0].z) return keys[0];
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (z <= b.z) {
      const t = (z - a.z) / (b.z - a.z);
      const k = t * t * (3 - 2 * t);
      const m = (x: number, y: number) => x + (y - x) * k;
      return { z, w: m(a.w, b.w), top: m(a.top, b.top), bot: m(a.bot, b.bot), p: m(a.p, b.p) };
    }
  }
  return keys[keys.length - 1];
}

/**
 * Lofts superellipse cross-sections along +Z. θ = 0 is the top, θ = π the bottom, matching the
 * body's uv convention (uv.x 0 = spine, 0.5 = belly). The last ring collapses to a rounded tip.
 */
function loft(keys: Key[], rings: number, radial: number, yOffset: (z: number) => number, uvAlong: number): BufferGeometry {
  const z0 = keys[0].z;
  const z1 = keys[keys.length - 1].z;
  const cols = radial + 1;
  const pos = new Float32Array(rings * cols * 3);
  const uv = new Float32Array(rings * cols * 2);
  for (let i = 0; i < rings; i++) {
    // Denser rings towards the tip so it rounds off smoothly.
    const t = i / (rings - 1);
    const z = z0 + (z1 - z0) * (1 - Math.pow(1 - t, 1.35));
    const k = sampleKeys(keys, z);
    const yo = yOffset(z);
    const e = 2 / k.p;
    for (let j = 0; j < cols; j++) {
      const th = (j / radial) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const x = k.w * Math.sign(s) * Math.pow(Math.abs(s), e);
      const y = (c >= 0 ? k.top : k.bot) * Math.sign(c) * Math.pow(Math.abs(c), e);
      const n = (i * cols + j) * 3;
      pos[n] = x;
      pos[n + 1] = y + yo;
      pos[n + 2] = z;
      uv[(i * cols + j) * 2] = j / radial;
      uv[(i * cols + j) * 2 + 1] = z * uvAlong;
    }
  }
  const index: number[] = [];
  for (let i = 0; i + 1 < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      // Counter-clockwise seen from outside: (towards the tip) × (θ step) is the outward normal.
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Tube along a curve whose radius tapers from `r0` to `r1` (horns, whiskers, fangs). */
function taperedTube(points: Vector3[], r0: number, r1: number, segments = 24, radial = 8): BufferGeometry {
  const curve = new CatmullRomCurve3(points);
  const g = new TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.getAttribute("position") as BufferAttribute;
  const cols = radial + 1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

export type PrototypeHead = {
  root: Group;
  jaw: Object3D;
  whiskers: [Object3D, Object3D];
  /** Materials whose colours follow the skin. */
  scaleMaterials: Material[];
  crystal: MeshStandardMaterial;
  eyeMaterial: MeshBasicMaterial;
  /**
   * Sets every skin-coloured material of the head: scales, crystal horns and brows, eyes, whiskers,
   * nostrils, mouth glow and fang tint. The build uses this same function, so a switched skin and a
   * fresh build always match.
   */
  applySkin: (skin: Skin) => void;
};

/**
 * @param neckRadius body radius at the neck ring; the head's back ring matches the body's
 *   cross-section there (width r, top 0.88 r, bottom 0.7 r), so head and body join without a step.
 */
export function buildPrototypeHead(skin: Skin, neckRadius: number, track: ResourceTracker["track"]): PrototypeHead {
  const r = neckRadius;
  const S = r / 0.216; // the head was sculpted for a 0.216 neck; scale everything to fit

  const skullMat = track(createScaleMaterial({ skin, repeat: [18, 7 / S], bellyFromNormal: true }));
  const jawMat = track(createScaleMaterial({ skin, repeat: [14, 7 / S], bellyFromNormal: true }));
  const crystal = track(
    new MeshStandardMaterial({ color: new Color(skin.body), emissive: new Color(skin.glow), emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.2, flatShading: true }),
  );
  const eyeMaterial = track(new MeshBasicMaterial({ color: new Color(skin.eyes).multiplyScalar(6) }));
  const dark = track(new MeshBasicMaterial({ color: 0x020203 }));
  const fangMat = track(new MeshStandardMaterial({ color: 0xd8d4c8, emissive: new Color(skin.highlight), emissiveIntensity: 0.25, roughness: 0.4 }));
  const nostrilMat = track(new MeshBasicMaterial({ color: new Color(skin.glow).multiplyScalar(3) }));

  const root = new Group();
  root.name = "Head";
  root.scale.setScalar(S);

  const neckSocket = new Object3D();
  neckSocket.name = "NeckSocket";
  root.add(neckSocket);

  // ---- Skull + upper snout. Back ring matches the body neck (r = 0.216 in sculpt units).
  const skullKeys: Key[] = [
    { z: -0.02, w: 0.216, top: 0.19, bot: 0.151, p: 2.0 },
    { z: 0.12, w: 0.27, top: 0.25, bot: 0.12, p: 2.3 },
    { z: 0.3, w: 0.29, top: 0.27, bot: 0.07, p: 2.6 }, // cranium and cheeks
    { z: 0.42, w: 0.24, top: 0.22, bot: 0.05, p: 2.6 }, // brow / eye line
    { z: 0.52, w: 0.19, top: 0.15, bot: 0.045, p: 2.5 }, // stop between brow and snout
    { z: 0.78, w: 0.16, top: 0.12, bot: 0.04, p: 2.4 },
    { z: 0.95, w: 0.13, top: 0.1, bot: 0.035, p: 2.2 }, // nostril bulge
    { z: 1.04, w: 0.0, top: 0.0, bot: 0.0, p: 2.0 },
  ];
  const skull = new Mesh(track(loft(skullKeys, 40, 48, (z) => 0.03 * Math.sin(Math.min(1, z) * Math.PI), 7)), skullMat);
  skull.name = "Skull";
  root.add(skull);

  // ---- Jaw, hinged behind the cheeks.
  const jaw = new Group();
  jaw.name = "Jaw";
  jaw.position.set(0, -0.06, 0.16);
  const jawKeys: Key[] = [
    { z: 0.0, w: 0.2, top: 0.02, bot: 0.09, p: 2.2 },
    { z: 0.2, w: 0.2, top: 0.03, bot: 0.11, p: 2.4 },
    { z: 0.55, w: 0.13, top: 0.03, bot: 0.07, p: 2.4 },
    { z: 0.8, w: 0.1, top: 0.025, bot: 0.05, p: 2.2 },
    { z: 0.86, w: 0.0, top: 0.0, bot: 0.0, p: 2.0 },
  ];
  const jawMesh = new Mesh(track(loft(jawKeys, 28, 32, () => 0, 7)), jawMat);
  jawMesh.name = "JawScales";
  jaw.add(jawMesh);
  // Mouth line: a thin dark slit with a faint glow, so the closed mouth still reads.
  const mouth = new Mesh(track(new SphereGeometry(1, 16, 8)), nostrilMat);
  mouth.name = "MouthGlow";
  mouth.scale.set(0.135, 0.006, 0.36);
  mouth.position.set(0, 0.03, 0.42);
  jaw.add(mouth);
  root.add(jaw);

  // ---- Fangs, from the upper jaw.
  for (const side of [-1, 1]) {
    const fang = new Mesh(track(new ConeGeometry(0.018, 0.09, 6)), fangMat);
    fang.name = side < 0 ? "Fang_R" : "Fang_L";
    fang.position.set(side * 0.1, -0.06, 0.82);
    fang.rotation.x = Math.PI; // point down
    root.add(fang);
  }

  // ---- Eyes: almond-shaped, the brightest point, with a dark slit pupil.
  const eyeGeo = track(new SphereGeometry(1, 20, 12));
  const pupilGeo = track(new SphereGeometry(1, 12, 8));
  const eyes: Object3D[] = [];
  for (const [side, name] of [[-1, "Eye_R"], [1, "Eye_L"]] as const) {
    const eye = new Group();
    eye.name = name;
    eye.position.set(side * 0.205, 0.13, 0.44);
    eye.rotation.set(-0.15, side * 0.55, side * -0.25);
    const ball = new Mesh(eyeGeo, eyeMaterial);
    ball.name = `${name}_Glow`;
    ball.scale.set(0.05, 0.03, 0.075);
    const pupil = new Mesh(pupilGeo, dark);
    pupil.name = `${name}_Pupil`;
    pupil.scale.set(0.008, 0.026, 0.02);
    pupil.position.set(side * 0.045, 0, 0.01);
    eye.add(ball, pupil);
    root.add(eye);
    eyes.push(eye);
    // Heavy brow ridge above each eye.
    const brow = new Mesh(track(taperedTube([new Vector3(side * 0.12, 0.25, 0.5), new Vector3(side * 0.22, 0.22, 0.42), new Vector3(side * 0.28, 0.24, 0.3)], 0.03, 0.012, 12, 6)), crystal);
    brow.name = side < 0 ? "Brow_R" : "Brow_L";
    root.add(brow);
  }

  // ---- Horns: two long swept-back crystal horns and two small brow horns.
  const horns = new Group();
  horns.name = "Horns";
  for (const side of [-1, 1]) {
    const big = new Mesh(
      track(
        taperedTube(
          [new Vector3(side * 0.13, 0.24, 0.28), new Vector3(side * 0.2, 0.36, 0.12), new Vector3(side * 0.27, 0.44, -0.12), new Vector3(side * 0.31, 0.56, -0.38)],
          0.045,
          0.004,
          28,
          7,
        ),
      ),
      crystal,
    );
    const small = new Mesh(
      track(taperedTube([new Vector3(side * 0.2, 0.22, 0.4), new Vector3(side * 0.27, 0.3, 0.32), new Vector3(side * 0.31, 0.37, 0.24)], 0.022, 0.003, 12, 6)),
      crystal,
    );
    big.name = side < 0 ? "Horn_R" : "Horn_L";
    small.name = side < 0 ? "BrowHorn_R" : "BrowHorn_L";
    horns.add(big, small);
  }
  root.add(horns);

  // ---- Nostrils.
  for (const side of [-1, 1]) {
    const n = new Mesh(pupilGeo, nostrilMat);
    n.name = side < 0 ? "Nostril_R" : "Nostril_L";
    n.scale.set(0.02, 0.012, 0.025);
    n.position.set(side * 0.055, 0.1, 0.96);
    root.add(n);
  }

  // ---- Whiskers: long, thin, glowing; they sway in DragonHead (pivot at the root).
  const whiskerMat = track(new MeshBasicMaterial({ color: new Color(skin.highlight).multiplyScalar(2.2) }));
  const whiskers: Object3D[] = [];
  for (const [side, name] of [[1, "Whisker_L"], [-1, "Whisker_R"]] as const) {
    const pivot = new Group();
    pivot.name = name;
    pivot.position.set(side * 0.12, 0.02, 0.88);
    const geo = track(
      taperedTube(
        [new Vector3(0, 0, 0), new Vector3(side * 0.18, -0.03, -0.12), new Vector3(side * 0.42, -0.02, -0.36), new Vector3(side * 0.62, 0.06, -0.7), new Vector3(side * 0.74, 0.12, -1.05)],
        0.012,
        0.002,
        40,
        5,
      ),
    );
    const whisker = new Mesh(geo, whiskerMat);
    whisker.name = `${name}_Strand`;
    pivot.add(whisker);
    root.add(pivot);
    whiskers.push(pivot);
  }

  const applySkin = (k: Skin) => {
    applyScaleSkin(skullMat, k);
    applyScaleSkin(jawMat, k);
    crystal.color.set(k.body);
    crystal.emissive.set(k.glow);
    eyeMaterial.color.set(k.eyes).multiplyScalar(6);
    whiskerMat.color.set(k.highlight).multiplyScalar(2.2);
    nostrilMat.color.set(k.glow).multiplyScalar(3); // nostrils and mouth glow
    fangMat.emissive.set(k.highlight); // fang tint
  };
  applySkin(skin);

  return {
    root,
    jaw,
    whiskers: [whiskers[0], whiskers[1]],
    scaleMaterials: [skullMat, jawMat],
    crystal,
    eyeMaterial,
    applySkin,
  };
}
