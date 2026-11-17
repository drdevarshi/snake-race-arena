/**
 * Snake Race Arena — game engine types.
 * The engine is pure TypeScript with no DOM access so the exact same code
 * runs in the browser (to play) and on the server (to verify replays).
 * Everything is integer, tick-based and deterministic: no Math.random, no Date.
 */

export type Dir = "U" | "D" | "L" | "R";

export const DIRS: Record<Dir, { x: number; y: number }> = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };

export interface Point {
  x: number;
  y: number;
}

/** Terrain of a single cell. */
export const Tile = {
  Ground: 0,
  Rock: 1, // solid: crash
  Water: 2, // slows the snake
  Bridge: 3, // crosses water at full speed
  Tunnel: 4, // teleports to its paired tunnel mouth
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type PowerUpKind = "boost" | "shield" | "magnet" | "energy";

export type SpeedSetting = "slow" | "normal" | "fast";

export interface Course {
  id: string;
  /** i18n key for the display name */
  nameKey: string;
  width: number;
  height: number;
  /** row-major, length width*height */
  tiles: Tile[];
  /** tunnel cell index → partner cell index */
  tunnels: Map<number, number>;
  /** tunnel cell index → pair number (for labels) */
  tunnelLabels: Map<number, number>;
  start: Point;
  startDir: Dir;
  snakeLength: number;
  apples: Point[];
  pickups: { kind: PowerUpKind; at: Point }[];
  defaultSpeed: SpeedSetting;
}

export type GameStatus = "running" | "dead" | "complete";
export type DeathReason = "wall" | "rock" | "self";

/** One accepted direction change, stamped with the tick it was entered on. */
export interface InputEvent {
  t: number;
  d: Dir;
}

export type GameEvent =
  | { type: "move" }
  | { type: "apple"; index: number }
  | { type: "pickup"; kind: PowerUpKind }
  | { type: "shieldUsed" }
  | { type: "tunnel" }
  | { type: "dead"; reason: DeathReason }
  | { type: "complete" };

export interface GameState {
  tick: number;
  status: GameStatus;
  speed: SpeedSetting;
  /** head first; length is fixed for the whole run */
  snake: Point[];
  /** previous positions (for smooth rendering); same length as snake */
  prevSnake: Point[];
  dir: Dir;
  /** buffered turns (max 2) */
  queue: Dir[];
  /** ticks since the last move */
  moveCounter: number;
  /** interval (ticks per move) that applied to the last/current move */
  interval: number;
  applesTaken: boolean[];
  applesCollected: number;
  pickupsTaken: boolean[];
  effects: {
    boostUntil: number;
    magnetUntil: number;
    energyUntil: number;
    shieldCharges: number;
    graceUntil: number;
  };
  moves: number;
  finishTick: number | null;
  deathReason: DeathReason | null;
  /** accepted inputs — submitted to the server for replay verification */
  inputs: InputEvent[];
  /** events produced by the most recent step (for sound/FX); cleared each step */
  events: GameEvent[];
}

/* ----------------------------- tuning ---------------------------------- */

/** Simulation tick length. Final times are exact multiples of this. */
export const TICK_MS = 20;

/** Ticks per one-cell move at each speed setting. */
export const MOVE_INTERVAL: Record<SpeedSetting, number> = {
  slow: 8, // 160 ms per cell
  normal: 6, // 120 ms per cell
  fast: 5, // 100 ms per cell
};

export const WATER_MULTIPLIER = 2;
export const BOOST_REDUCTION = 2;
export const MIN_INTERVAL = 3;

export const POWERUP_TICKS = {
  boost: 150, // 3 s
  magnet: 250, // 5 s
  energy: 300, // 6 s
} as const;

/** After a shield absorbs a crash, further crashes only stall the snake for this many ticks. */
export const SHIELD_GRACE_TICKS = 20;
export const MAGNET_RADIUS = 2;
export const MAX_QUEUED_TURNS = 2;
/** Hard cap so a replay can never run forever (10 minutes). */
export const MAX_RUN_TICKS = (10 * 60 * 1000) / TICK_MS;
