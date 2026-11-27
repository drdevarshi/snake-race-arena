"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, OrbitControls, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { FogExp2, REVISION } from "three";
import r3fPackage from "@react-three/fiber/package.json";
import { Dragon } from "./Dragon";
import { QUALITY, type Quality } from "./quality";
import { SKINS, type SkinId } from "./skins";

export type FrameStats = {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  /** Versions actually running (debug panel). */
  three: string;
  r3f: string;
};

export type DragonLabSceneProps = {
  skinId: SkinId;
  quality: Quality;
  paused: boolean;
  /** Called about twice a second with renderer statistics. */
  onStats?: (s: FrameStats) => void;
  /** Called every frame with the frame time in ms, for the benchmark. */
  onFrame?: (ms: number) => void;
  onContextLost?: () => void;
};

/** Dark trunks around the stage, like the forest in the reference (positions are fixed). */
const TRUNKS: [number, number, number][] = [
  [-9.5, -6, 0.55],
  [-6.8, -9.5, 0.42],
  [-2.2, -11, 0.6],
  [3.5, -10.2, 0.48],
  [8.2, -7.5, 0.58],
  [10.5, -2.5, 0.4],
  [-11, 1.5, 0.45],
  [-8, 7, 0.5],
  [9, 6.5, 0.52],
  [1.5, -7.2, 0.35],
];

function Stage({ quality, skinId }: { quality: Quality; skinId: SkinId }) {
  const q = QUALITY[quality];
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new FogExp2("#070712", 0.032), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  return (
    <>
      <color attach="background" args={["#05050c"]} />
      <hemisphereLight args={["#4a52a0", "#08080a", 2.2]} />
      <directionalLight position={[-6, 12, 4]} intensity={1.4} color="#8fa3ff" />

      {/* Shallow water floor. Mirror reflections on High only; they render the scene twice. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        {q.reflections ? (
          <MeshReflectorMaterial
            resolution={512}
            mirror={0.85}
            blur={[160, 50]}
            mixBlur={1}
            mixStrength={4}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            roughness={0.85}
            metalness={0.55}
            color="#07070d"
          />
        ) : (
          <meshStandardMaterial color="#06060b" roughness={0.35} metalness={0.6} />
        )}
      </mesh>

      {TRUNKS.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 7, z]}>
          <cylinderGeometry args={[r * 0.85, r * 1.15, 14, 10, 1, true]} />
          <meshStandardMaterial color="#5a4a4c" roughness={0.95} />
        </mesh>
      ))}

      <Sparkles count={q.sparks} scale={[18, 5, 14]} position={[0, 2.5, 0]} size={2.2} speed={0.3} opacity={0.8} color={SKINS[skinId].highlight} />
    </>
  );
}

/**
 * Keeps the whole figure-of-eight in view on any screen shape: on tall, narrow screens (phones)
 * the camera moves back along its current direction. Runs only when the shape changes, so it never
 * fights the orbit controls.
 */
function CameraFit() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const base = 10.1; // distance that frames the route at 16:10
    const dist = aspect >= 1.3 ? base : base * Math.pow(1.3 / aspect, 0.85);
    const dir = camera.position.clone().setY(camera.position.y - 0.9).normalize();
    camera.position.set(dir.x * dist, 0.9 + dir.y * dist, dir.z * dist);
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

function PerfProbe({ onStats, onFrame }: Pick<DragonLabSceneProps, "onStats" | "onFrame">) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, time: 0, last: 0 });
  useEffect(() => {
    // Post-processing renders several passes per frame; count them all, reset once per frame.
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames++;
    a.time += delta;
    onFrame?.(delta * 1000);
    if (a.time >= 0.5) {
      onStats?.({
        fps: a.frames / a.time,
        frameMs: (a.time / a.frames) * 1000,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        three: REVISION,
        r3f: r3fPackage.version,
      });
      a.frames = 0;
      a.time = 0;
    }
    gl.info.reset();
  });
  return null;
}

export default function DragonLabScene({ skinId, quality, paused, onStats, onFrame, onContextLost }: DragonLabSceneProps) {
  const q = QUALITY[quality];
  return (
    <Canvas
      // Tone mapping is done once, in the post-processing pass.
      flat
      dpr={q.dpr}
      camera={{ position: [0, 3.4, 9.5], fov: 48, near: 0.1, far: 120 }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <Stage quality={quality} skinId={skinId} />
      <Dragon skinId={skinId} quality={quality} paused={paused} />
      <CameraFit />
      <OrbitControls target={[0, 0.9, 0]} enablePan={false} minDistance={4} maxDistance={32} maxPolarAngle={1.45} enableDamping />
      <EffectComposer multisampling={q.multisampling} enableNormalPass={false}>
        {q.bloom ? <Bloom mipmapBlur intensity={1.5} luminanceThreshold={0.75} luminanceSmoothing={0.3} radius={0.8} /> : <></>}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
      <PerfProbe onStats={onStats} onFrame={onFrame} />
    </Canvas>
  );
}
