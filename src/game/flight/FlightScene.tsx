"use client";

/**
 * The free-flight sandbox scene: the world drawn from the same numbers the engine collides with,
 * the Dragon Lab dragon driven by the engine, and the chase camera.
 *
 * Each animation frame: run as many fixed 20 ms engine ticks as are due, place the dragon between
 * the last two ticks (smooth on any refresh rate), then move the camera. Rendering never feeds back
 * into the engine.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, FogExp2, Vector2, type PerspectiveCamera } from "three";
import { Dragon, type DragonFollow } from "../dragon/Dragon";
import { PerfProbe, type FrameStats } from "../dragon/DragonLabScene";
import { BODY_LENGTH } from "../dragon/dragonBuild";
import { QUALITY, type Quality } from "../dragon/quality";
import type { SkinId } from "../dragon/skins";
import type { InputFrame } from "../world3d/controls";
import type { FlightState } from "../world3d/flight";
import { groundHeight, SANDBOX } from "../world3d/world";
import { createRig, stepRig } from "./cameraRig";
import type { FlightSession, Playback } from "./session";

const W = SANDBOX;
const M = 1 / 1000; // engine millimetres → metres
const TURN_TO_RAD = (2 * Math.PI) / 65536;

/** Everything the page shares with the scene. Read every frame; never causes a React render. */
export type FlightController = {
  session: FlightSession;
  playback: Playback | null;
  input: InputFrame;
  /** Look-around offset from dragging (radians); eases back to 0 when released. */
  look: { yaw: number; pitch: number; dragging: boolean };
  paused: boolean;
  /** Bumped on every restart or replay so the body and camera are laid out afresh. */
  reset: number;
  onPlaybackEnd?: (matches: boolean) => void;
};

export type Hud = { speed: number; altitude: number; tick: number; hash: number; contacts: number; replaying: boolean };

export type FlightSceneProps = {
  controller: { current: FlightController };
  /** Dragon length in metres; the page remounts the flight when it changes. */
  size: 12 | 20;
  paused: boolean;
  skinId: SkinId;
  quality: Quality;
  onHud: (h: Hud) => void;
  onStats?: (s: FrameStats) => void;
  onFrame?: (ms: number) => void;
  onContextLost?: () => void;
};

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % 65536;
  if (d > 32768) d -= 65536;
  if (d < -32768) d += 65536;
  return (a + d * t) * TURN_TO_RAD;
}

/** Runs the engine, places the dragon and moves the camera. Mounted before the dragon so it runs first each frame. */
function Driver({ controller, follow, onHud }: { controller: FlightSceneProps["controller"]; follow: { current: DragonFollow | null }; onHud: (h: Hud) => void }) {
  const camera = useThree((s) => s.camera);
  const rig = useMemo(() => createRig(), []);
  const hudClock = useRef(0);
  const lastReset = useRef(-1);

  useFrame((_, rawDelta) => {
    const c = controller.current;
    const dt = Math.min(rawDelta, 0.1);
    let cur: FlightState;
    let prev: FlightState;
    let alpha = 1;
    if (c.playback) {
      const p = c.playback;
      if (!c.paused) alpha = p.advance(dt * 1000);
      cur = p.state;
      prev = p.prev;
      if (p.done) {
        c.playback = null;
        c.onPlaybackEnd?.(p.matches);
      }
    } else {
      if (!c.paused) alpha = c.session.advance(dt * 1000, c.input);
      cur = c.session.state;
      prev = c.session.prev;
    }
    if (c.paused) alpha = 1;
    const head = {
      x: (prev.x + (cur.x - prev.x) * alpha) * M,
      y: (prev.y + (cur.y - prev.y) * alpha) * M,
      z: (prev.z + (cur.z - prev.z) * alpha) * M,
    };
    const yaw = lerpAngle(prev.yaw, cur.yaw, alpha);
    const pitch = lerpAngle(prev.pitch, cur.pitch, alpha);
    const bank = lerpAngle(prev.bank, cur.bank, alpha);
    follow.current = { ...head, yaw, bank, reset: c.reset };

    if (lastReset.current !== c.reset) {
      lastReset.current = c.reset;
      rig.ready = false; // jump straight behind the dragon after a restart or replay
    }
    // Look-around eases back to straight ahead once released.
    if (!c.look.dragging) {
      const k = 1 - Math.exp(-4 * dt);
      c.look.yaw -= c.look.yaw * k;
      c.look.pitch -= c.look.pitch * k;
    }
    stepRig(rig, { head, yaw, pitch, size: c.session.size }, c.paused ? 0 : dt, W, c.look.yaw, c.look.pitch);
    camera.position.set(rig.pos.x, rig.pos.y, rig.pos.z);
    camera.lookAt(rig.look.x, rig.look.y, rig.look.z);

    hudClock.current += rawDelta;
    if (hudClock.current >= 0.2) {
      hudClock.current = 0;
      onHud({
        speed: cur.speed * M * 50, // mm per tick → m/s
        altitude: (cur.y - groundHeight(W, cur.x, cur.z)) * M,
        tick: cur.tick,
        hash: cur.hash,
        contacts: cur.contacts,
        replaying: c.playback !== null,
      });
    }
  });
  return null;
}

/** Wider view on portrait phones so the dragon and what is ahead both fit. */
function Lens() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    camera.fov = aspect < 1 ? 72 : 58;
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

function Sandbox() {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new FogExp2("#0a0c1c", 0.0055), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  // The hill is the same dome the engine uses: height h·(1 − d²/r²).
  const hillProfile = useMemo(() => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const d = (i / 24) * W.hill.r * M;
      pts.push(new Vector2(d, W.hill.h * M * (1 - (d * d) / (W.hill.r * M) ** 2)));
    }
    return pts.reverse();
  }, []);
  const deck = W.deck;
  const pool = W.pool;
  // A 4-segment ring is a square; its sides sit at radius·cos 45°, so this puts them on the edge.
  const edgeR = W.edge * M * Math.SQRT2;

  return (
    <>
      <color attach="background" args={["#0a0c1c"]} />
      <hemisphereLight args={["#8c98e8", "#1a1622", 2.2]} />
      <directionalLight position={[-60, 120, 40]} intensity={2.2} color="#c8d2ff" />

      {/* Floor with a grid so speed and height are easy to judge. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[W.hardEdge * M * 2.4, W.hardEdge * M * 2.4]} />
        <meshStandardMaterial color="#10121f" roughness={0.95} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[W.hardEdge * M * 2, W.hardEdge * M * 2]}
        cellSize={5}
        cellThickness={0.6}
        cellColor="#262c52"
        sectionSize={25}
        sectionThickness={1.1}
        sectionColor="#3c4a9a"
        fadeDistance={260}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Pool: drawn only; its surface is the floor until swimming arrives. */}
      <mesh rotation-x={-Math.PI / 2} position={[((pool.x0 + pool.x1) / 2) * M, 0.05, ((pool.z0 + pool.z1) / 2) * M]}>
        <planeGeometry args={[(pool.x1 - pool.x0) * M, (pool.z1 - pool.z0) * M]} />
        <meshStandardMaterial color="#0d3a5c" emissive="#06324a" emissiveIntensity={0.6} roughness={0.15} metalness={0.4} transparent opacity={0.85} />
      </mesh>

      <mesh position={[W.hill.x * M, 0, W.hill.z * M]}>
        <latheGeometry args={[hillProfile, 48]} />
        <meshStandardMaterial color="#1d2a2a" roughness={0.9} side={DoubleSide} />
      </mesh>

      <mesh position={[((deck.x0 + deck.x1) / 2) * M, ((deck.y0 + deck.y1) / 2) * M, ((deck.z0 + deck.z1) / 2) * M]}>
        <boxGeometry args={[(deck.x1 - deck.x0) * M, (deck.y1 - deck.y0) * M, (deck.z1 - deck.z0) * M]} />
        <meshStandardMaterial color="#3a3550" roughness={0.7} emissive="#ff3fa4" emissiveIntensity={0.05} />
      </mesh>

      {W.pillars.map((p, i) => (
        <group key={`p${i}`} position={[p.x * M, 0, p.z * M]}>
          <mesh position={[0, (p.h * M) / 2, 0]}>
            <cylinderGeometry args={[p.r * M, p.r * M, p.h * M, 20]} />
            <meshStandardMaterial color="#5c5878" roughness={0.8} />
          </mesh>
          {/* Glowing cap ring so the top is easy to see. */}
          <mesh position={[0, p.h * M, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[p.r * M * 0.8, p.r * M, 24]} />
            <meshStandardMaterial color="#22e6ff" emissive="#22e6ff" emissiveIntensity={2} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      {W.poles.map((p, i) => (
        <mesh key={`c${i}`} position={[p.x * M, (p.h * M) / 2, p.z * M]}>
          <cylinderGeometry args={[p.r * M, p.r * M, p.h * M, 10]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff8a00" emissiveIntensity={0.6} roughness={0.5} />
        </mesh>
      ))}

      {/* Soft edge: a faint glowing line where the dragon starts turning home. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[edgeR - 0.85, edgeR + 0.85, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#ff3fa4" transparent opacity={0.5} />
      </mesh>
    </>
  );
}

export default function FlightScene({ controller, size, paused, skinId, quality, onHud, onStats, onFrame, onContextLost }: FlightSceneProps) {
  const q = QUALITY[quality];
  const follow = useRef<DragonFollow | null>(null);
  return (
    <Canvas
      flat
      dpr={q.dpr}
      camera={{ position: [0, 14, 140], fov: 58, near: 0.3, far: 700 }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <Sandbox />
      <Driver controller={controller} follow={follow} onHud={onHud} />
      <Dragon skinId={skinId} quality={quality} paused={paused} follow={follow} scale={size / BODY_LENGTH} />
      <Lens />
      <EffectComposer multisampling={q.multisampling} enableNormalPass={false}>
        {q.bloom ? <Bloom mipmapBlur intensity={1.2} luminanceThreshold={0.8} luminanceSmoothing={0.3} radius={0.7} /> : <></>}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
      <PerfProbe onStats={onStats} onFrame={onFrame} />
    </Canvas>
  );
}
