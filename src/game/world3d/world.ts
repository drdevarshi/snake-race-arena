/**
 * The M2a test sandbox, in millimetres. These simple shapes are what the engine collides with; the
 * 3D scene draws matching art from the same numbers. About 400 × 400 m, edged by fog.
 */

export type Pillar = { x: number; z: number; r: number; h: number };
export type Box = { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
export type Hill = { x: number; z: number; r: number; h: number };

export type World = {
  id: "sandbox-v1";
  /** Soft edge: beyond it the dragon is steered back toward the centre. */
  edge: number;
  /** Hard edge: positions are clamped here. */
  hardEdge: number;
  ceiling: number;
  hill: Hill;
  deck: Box;
  pillars: Pillar[];
  /** Thin, cable-like poles to fly between (same collision as pillars). */
  poles: Pillar[];
  /** The pool is drawn only; its surface is the floor until swimming arrives in M2c. */
  pool: { x0: number; x1: number; z0: number; z1: number; depth: number };
  start: { x: number; y: number; z: number; yaw: number };
};

export const SANDBOX: World = {
  id: "sandbox-v1",
  edge: 185_000,
  hardEdge: 200_000,
  ceiling: 150_000,
  hill: { x: -90_000, z: 60_000, r: 60_000, h: 22_000 },
  // A raised "deck" 80 m long, 20 m wide, 12–15 m up: fly over it or through the gap underneath.
  deck: { x0: -40_000, x1: 40_000, z0: -60_000, z1: -40_000, y0: 12_000, y1: 15_000 },
  pillars: [
    { x: 40_000, z: 30_000, r: 4_000, h: 40_000 },
    { x: 65_000, z: 0, r: 3_000, h: 25_000 },
    { x: 80_000, z: -40_000, r: 5_000, h: 60_000 },
    { x: -35_000, z: 15_000, r: 3_500, h: 30_000 },
    { x: 14_000, z: 55_000, r: 4_500, h: 50_000 },
    { x: -65_000, z: -25_000, r: 3_000, h: 20_000 },
  ],
  poles: [
    { x: 12_000, z: 10_000, r: 700, h: 35_000 },
    { x: 22_000, z: 10_000, r: 700, h: 35_000 },
    { x: 12_000, z: -5_000, r: 700, h: 35_000 },
    { x: 22_000, z: -5_000, r: 700, h: 35_000 },
  ],
  pool: { x0: 30_000, x1: 130_000, z0: 70_000, z1: 130_000, depth: 12_000 },
  start: { x: 0, y: 10_000, z: 120_000, yaw: 32_768 }, // facing −z, toward the deck
};

/** Ground height at (x, z): the floor (0) or the hill, a smooth dome. Integers only. */
export function groundHeight(w: World, x: number, z: number): number {
  const dx = x - w.hill.x;
  const dz = z - w.hill.z;
  const d2 = dx * dx + dz * dz;
  const r2 = w.hill.r * w.hill.r;
  if (d2 >= r2) return 0;
  return Math.trunc((w.hill.h * (r2 - d2)) / r2);
}
