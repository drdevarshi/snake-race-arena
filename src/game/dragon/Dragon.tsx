"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Shape,
  ShapeGeometry,
  Vector3,
  type ShaderMaterial,
} from "three";
import { createBodyGeometry, updateBodyGeometry } from "./bodyGeometry";
import { HeadPath, computeFrames, radiusProfile, samplePath, type Frame, type Vec3 } from "./bodyPath";
import { buildPrototypeHead, type PrototypeHead } from "./prototypeHead";
import { createCountedTracker } from "./resources";
import { createRoute, slitherAt } from "./route";
import { applySkin, createScaleMaterial } from "./scaleMaterial";
import { SKINS, type SkinId } from "./skins";
import type { Quality } from "./quality";
import { QUALITY } from "./quality";

/** Body radius at its thickest point (metres). */
export const MAX_RADIUS = 0.4;
/** Body length from neck to tail tip (metres). Fixed, as in competitive modes. */
export const BODY_LENGTH = 7.8;
/** Head speed along the showcase route (metres per second). */
const SPEED = 2.3;
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

type Built = {
  body: Mesh;
  bodyMat: ShaderMaterial;
  ridges: InstancedMesh;
  ridgeRings: number[];
  fin: Mesh;
  head: PrototypeHead;
  crystals: MeshStandardMaterial[];
  dispose: () => void;
};

function build(skinId: SkinId, quality: Quality): Built {
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

  return { body, bodyMat, ridges, ridgeRings, fin, head, crystals: [crystal, finMat, head.crystal], dispose: () => tracker.disposeAll() };
}

export type DragonProps = { skinId: SkinId; quality: Quality; paused: boolean };

export function Dragon({ skinId, quality, paused }: DragonProps) {
  const [built, setBuilt] = useState<Built | null>(null);
  const route = useMemo(() => createRoute(), []);
  const light = useRef<PointLight>(null);
  // Motion state lives in refs: it changes every frame and must not re-render React.
  const sim = useRef({ s: 0, time: 0, path: new HeadPath(BODY_LENGTH + 2, 0.008) });

  // Build GPU resources in an effect so Strict Mode's mount → unmount → mount stays balanced.
  // Rebuilt only when the quality tier changes; skin changes are applied in place below.
  const skinRef = useRef(skinId);
  skinRef.current = skinId;
  useEffect(() => {
    const b = build(skinRef.current, quality);
    setBuilt(b);
    return () => {
      setBuilt(null);
      b.dispose();
    };
  }, [quality]);

  useEffect(() => {
    if (!built) return;
    const skin = SKINS[skinId];
    applySkin(built.bodyMat, skin);
    for (const m of built.head.scaleMaterials) applySkin(m as ShaderMaterial, skin);
    for (const c of built.crystals) {
      c.color.set(skin.body);
      c.emissive.set(skin.glow);
    }
    built.head.eyeMaterial.color.set(skin.eyes).multiplyScalar(6);
    light.current?.color.set(skin.glow);
  }, [built, skinId]);

  // Seed the trail so the whole body is laid out along the route from the first frame.
  useEffect(() => {
    const { path } = sim.current;
    path.clear();
    for (let s = -BODY_LENGTH - 1; s <= sim.current.s; s += 0.02) path.push(slitherAt(route, s));
  }, [route]);

  const scratch = useMemo(
    () => ({ m: new Matrix4(), x: new Vector3(), y: new Vector3(), z: new Vector3(), p: new Vector3(), scl: new Vector3() }),
    [],
  );

  useFrame((_, rawDelta) => {
    if (!built) return;
    const q = QUALITY[quality];
    const st = sim.current;
    const dt = Math.min(rawDelta, 0.1);
    if (!paused) {
      st.s += SPEED * dt;
      st.time += dt;
      st.path.push(slitherAt(route, st.s));
    }

    const spacing = BODY_LENGTH / (q.rings - 1);
    const pts = samplePath(st.path, q.rings, spacing);
    const frames = computeFrames(pts);
    const radii = pts.map((_, i) => MAX_RADIUS * radiusProfile(i / (q.rings - 1)));
    updateBodyGeometry(built.body.geometry, pts, frames, radii);

    const place = (obj: { matrix: Matrix4 } | null, p: Vec3, f: Frame, offset = 0, size = 1) => {
      scratch.z.set(f.t.x, f.t.y, f.t.z);
      scratch.y.set(f.n.x, f.n.y, f.n.z);
      scratch.x.crossVectors(scratch.y, scratch.z); // x = n × t (right-handed with y = n, z = t)
      scratch.m.makeBasis(scratch.x, scratch.y, scratch.z);
      scratch.p.set(p.x + f.n.x * offset, p.y + f.n.y * offset, p.z + f.n.z * offset);
      scratch.m.setPosition(scratch.p);
      scratch.scl.setScalar(size);
      scratch.m.scale(scratch.scl);
      if (obj) obj.matrix.copy(scratch.m);
      return scratch.m;
    };

    // Ridges: on the spine, shrinking towards the tail.
    built.ridgeRings.forEach((i, k) => {
      const u = i / (q.rings - 1);
      // Tallest behind the head, shrinking to the tail, alternating tall/short like a crest.
      const size = radii[i] * (1.15 - 0.55 * u) * (k % 2 === 0 ? 1 : 0.62);
      built.ridges.setMatrixAt(k, place(null, pts[i], frames[i], radii[i] * 0.78, size));
    });
    built.ridges.instanceMatrix.needsUpdate = true;

    // Tail fin at the tip; head at the neck ring.
    const lastI = q.rings - 1;
    built.fin.matrixAutoUpdate = false;
    place(built.fin, pts[lastI], frames[lastI], 0, 0.55);
    const headRoot = built.head.root;
    headRoot.matrixAutoUpdate = false;
    place(headRoot, pts[0], frames[0]);
    headRoot.matrix.scale(scratch.scl.setScalar(headRoot.scale.x));

    // Living details: breathing jaw (0–35° allowed by the contract), swaying whiskers.
    const t = st.time;
    built.head.jaw.rotation.x = 0.06 + 0.06 * Math.sin(t * 1.3);
    built.head.whiskers[0].rotation.set(0.12 * Math.sin(t * 1.7), 0.2 * Math.sin(t * 2.1), 0);
    built.head.whiskers[1].rotation.set(0.12 * Math.sin(t * 1.7 + 1), -0.2 * Math.sin(t * 2.1 + 0.6), 0);

    // The dragon is the main light: a glow just above the head.
    const f0 = frames[0];
    const lp = { x: pts[0].x + f0.n.x * 0.4 + f0.t.x * 0.3, y: pts[0].y + f0.n.y * 0.4 + f0.t.y * 0.3, z: pts[0].z + f0.n.z * 0.4 + f0.t.z * 0.3 };
    light.current?.position.set(lp.x, lp.y, lp.z);
    for (const m of [built.bodyMat, ...(built.head.scaleMaterials as ShaderMaterial[])]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uDragonLightPos.value.set(lp.x, lp.y, lp.z);
    }
  });

  if (!built) return null;
  return (
    <group>
      <primitive object={built.body} dispose={null} />
      <primitive object={built.ridges} dispose={null} />
      <primitive object={built.fin} dispose={null} />
      <primitive object={built.head.root} dispose={null} />
      <pointLight ref={light} color={SKINS[skinId].glow} intensity={QUALITY[quality].dragonLight} distance={9} decay={2} />
    </group>
  );
}
