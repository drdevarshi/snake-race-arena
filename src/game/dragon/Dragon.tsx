"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Matrix4, PointLight, Vector3, type ShaderMaterial } from "three";
import { updateBodyGeometry } from "./bodyGeometry";
import { HeadPath, computeFramesInto, samplePathInto, type Frame, type Vec3 } from "./bodyPath";
import { BODY_LENGTH, build, type Built } from "./dragonBuild";
import { createRoute, slitherAt } from "./route";
import { SKINS, type SkinId } from "./skins";
import { QUALITY, type Quality } from "./quality";

/** Head speed along the showcase route (metres per second). */
const SPEED = 2.3;

/**
 * Where an outside driver (the flight sandbox) wants the head this frame, in world metres.
 * `yaw` (radians, 0 faces +z) lays the body out straight behind the head whenever `reset`
 * changes (a new flight or a replay); `bank` (radians) leans the head into turns.
 */
export type DragonFollow = { x: number; y: number; z: number; yaw: number; bank: number; reset: number };

export type DragonProps = {
  skinId: SkinId;
  quality: Quality;
  paused: boolean;
  /** When given, the head follows this instead of the showcase route. Read every frame. */
  follow?: { current: DragonFollow | null };
  /** World metres per Dragon Lab metre (the lab dragon is 7.8 m long). Default 1. */
  scale?: number;
};

/** Gentle side-to-side slither added while following (in dragon metres). */
const WAVE_AMPLITUDE = 0.12;
const WAVE_LENGTH = 3.5;

export function Dragon({ skinId, quality, paused, follow, scale = 1 }: DragonProps) {
  const [built, setBuilt] = useState<Built | null>(null);
  const route = useMemo(() => createRoute(), []);
  const light = useRef<PointLight>(null);
  // Motion state lives in refs: it changes every frame and must not re-render React.
  const sim = useRef({ s: 0, time: 0, path: new HeadPath(BODY_LENGTH + 2, 0.008), reset: Number.NaN, travelled: 0, last: { x: 0, z: 0 } });

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
    built.applySkin(skin); // every material: body, crest, fin, head, eyes, whiskers, nostrils, mouth, fangs
    light.current?.color.set(skin.glow); // the dragon light
  }, [built, skinId]);

  // Seed the trail so the whole body is laid out along the route from the first frame.
  useEffect(() => {
    if (follow) return; // laid out from the first followed position instead
    const { path } = sim.current;
    path.clear();
    for (let s = -BODY_LENGTH - 1; s <= sim.current.s; s += 0.02) path.push(slitherAt(route, s));
  }, [route, follow]);

  const scratch = useMemo(
    () => ({ m: new Matrix4(), roll: new Matrix4(), x: new Vector3(), y: new Vector3(), z: new Vector3(), p: new Vector3(), scl: new Vector3(), light: new Vector3() }),
    [],
  );

  useFrame((_, rawDelta) => {
    if (!built) return;
    // Sizes come from the build itself: for a frame after a quality switch, `built` can still be
    // the previous tier's while the `quality` prop is already the new one.
    const rings = built.work.pts.length;
    const st = sim.current;
    const dt = Math.min(rawDelta, 0.1);
    const f = follow?.current;
    if (follow) {
      if (!f) return;
      const hx = f.x / scale;
      const hy = f.y / scale;
      const hz = f.z / scale;
      const fx = Math.sin(f.yaw);
      const fz = Math.cos(f.yaw);
      if (f.reset !== st.reset) {
        // New flight or replay: lay the body out straight behind the head.
        st.reset = f.reset;
        st.travelled = 0;
        st.path.clear();
        for (let d = BODY_LENGTH + 1; d >= 0; d -= 0.02) st.path.push({ x: hx - fx * d, y: hy, z: hz - fz * d });
      } else {
        st.travelled += Math.hypot(hx - st.last.x, hz - st.last.z);
      }
      st.last = { x: hx, z: hz };
      // Slither: a small sideways wave along the distance flown (none while hovering).
      const wave = WAVE_AMPLITUDE * Math.sin((st.travelled / WAVE_LENGTH) * Math.PI * 2);
      st.path.push({ x: hx + fz * wave, y: hy, z: hz - fx * wave });
      if (!paused) st.time += dt;
    } else if (!paused) {
      st.s += SPEED * dt;
      st.time += dt;
      st.path.push(slitherAt(route, st.s));
    }

    const spacing = BODY_LENGTH / (rings - 1);
    const { pts, frames, radii } = built.work;
    samplePathInto(st.path, pts, spacing);
    computeFramesInto(pts, frames);
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
      const u = i / (rings - 1);
      // Tallest behind the head, shrinking to the tail, alternating tall/short like a crest.
      const size = radii[i] * (1.15 - 0.55 * u) * (k % 2 === 0 ? 1 : 0.62);
      built.ridges.setMatrixAt(k, place(null, pts[i], frames[i], radii[i] * 0.78, size));
    });
    built.ridges.instanceMatrix.needsUpdate = true;

    // Tail fin at the tip; head at the neck ring.
    const lastI = rings - 1;
    built.fin.matrixAutoUpdate = false;
    place(built.fin, pts[lastI], frames[lastI], 0, 0.55);
    const headRoot = built.head.root;
    headRoot.matrixAutoUpdate = false;
    place(headRoot, pts[0], frames[0]);
    headRoot.matrix.scale(scratch.scl.setScalar(headRoot.scale.x));
    // Lean the head into turns (the body follows the flight path and does not roll).
    if (f && f.bank !== 0) headRoot.matrix.multiply(scratch.roll.makeRotationZ(-f.bank * 0.7));

    // Living details: breathing jaw (0–35° allowed by the contract), swaying whiskers.
    const t = st.time;
    built.head.jaw.rotation.x = 0.06 + 0.06 * Math.sin(t * 1.3);
    built.head.whiskers[0].rotation.set(0.12 * Math.sin(t * 1.7), 0.2 * Math.sin(t * 2.1), 0);
    built.head.whiskers[1].rotation.set(0.12 * Math.sin(t * 1.7 + 1), -0.2 * Math.sin(t * 2.1 + 0.6), 0);

    // The dragon is the main light: a glow just above the head.
    const f0 = frames[0];
    const lp = scratch.light.set(pts[0].x + f0.n.x * 0.4 + f0.t.x * 0.3, pts[0].y + f0.n.y * 0.4 + f0.t.y * 0.3, pts[0].z + f0.n.z * 0.4 + f0.t.z * 0.3);
    light.current?.position.set(lp.x, lp.y, lp.z);
    const mats = built.head.scaleMaterials as ShaderMaterial[];
    for (let i = -1; i < mats.length; i++) {
      const m = i < 0 ? built.bodyMat : mats[i];
      m.uniforms.uTime.value = t;
      // The shader works in world space; the group is scaled about the origin.
      m.uniforms.uDragonLightPos.value.copy(lp).multiplyScalar(scale);
    }
  });

  if (!built) return null;
  return (
    <group scale={scale}>
      <primitive object={built.body} dispose={null} />
      <primitive object={built.ridges} dispose={null} />
      <primitive object={built.fin} dispose={null} />
      <primitive object={built.head.root} dispose={null} />
      <pointLight ref={light} color={SKINS[skinId].glow} intensity={QUALITY[quality].dragonLight} distance={9 * scale} decay={2} />
    </group>
  );
}
