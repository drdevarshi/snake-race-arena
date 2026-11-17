import {
  BOOST_REDUCTION, DIRS, MAGNET_RADIUS, MAX_QUEUED_TURNS, MIN_INTERVAL, MOVE_INTERVAL, OPPOSITE,
  POWERUP_TICKS, SHIELD_GRACE_TICKS, Tile, WATER_MULTIPLIER,
  type Course, type DeathReason, type Dir, type GameState, type Point, type SpeedSetting,
} from "./types";

/* ------------------------------ helpers -------------------------------- */

export function tileAt(course: Course, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= course.width || y >= course.height) return Tile.Rock;
  return course.tiles[y * course.width + x];
}

/** Cell the head ends up in when moving from `from` in `dir` (follows tunnels). Null when leaving the map. */
export function nextHeadPosition(course: Course, from: Point, dir: Dir): { pos: Point; outOfBounds: boolean; tunnel: boolean } {
  const d = DIRS[dir];
  const x = from.x + d.x;
  const y = from.y + d.y;
  if (x < 0 || y < 0 || x >= course.width || y >= course.height) return { pos: { x, y }, outOfBounds: true, tunnel: false };
  const idx = y * course.width + x;
  const partner = course.tunnels.get(idx);
  if (partner !== undefined) {
    return { pos: { x: partner % course.width, y: Math.floor(partner / course.width) }, outOfBounds: false, tunnel: true };
  }
  return { pos: { x, y }, outOfBounds: false, tunnel: false };
}

/** Ticks per move right now, given terrain under the head and active power-ups. */
export function currentInterval(state: GameState, course: Course): number {
  const head = state.snake[0];
  let interval = MOVE_INTERVAL[state.speed];
  const onWater = tileAt(course, head.x, head.y) === Tile.Water;
  if (onWater && state.tick >= state.effects.energyUntil) interval *= WATER_MULTIPLIER;
  if (state.tick < state.effects.boostUntil) interval -= BOOST_REDUCTION;
  return Math.max(MIN_INTERVAL, interval);
}

/* ------------------------------ lifecycle ------------------------------ */

export function createGame(course: Course, speed: SpeedSetting = course.defaultSpeed): GameState {
  const back = DIRS[OPPOSITE[course.startDir]];
  const snake: Point[] = Array.from({ length: course.snakeLength }, (_, k) => ({
    x: course.start.x + back.x * k,
    y: course.start.y + back.y * k,
  }));
  const state: GameState = {
    tick: 0,
    status: "running",
    speed,
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    dir: course.startDir,
    queue: [],
    moveCounter: 0,
    interval: MOVE_INTERVAL[speed],
    applesTaken: course.apples.map(() => false),
    applesCollected: 0,
    pickupsTaken: course.pickups.map(() => false),
    effects: { boostUntil: 0, magnetUntil: 0, energyUntil: 0, shieldCharges: 0, graceUntil: 0 },
    moves: 0,
    finishTick: null,
    deathReason: null,
    inputs: [],
    events: [],
  };
  state.interval = currentInterval(state, course);
  return state;
}

/**
 * Queue a direction change. Ignores no-ops and 180° reversals (relative to the
 * last queued direction). Accepted inputs are logged with the current tick.
 * Returns true when accepted.
 */
export function applyInput(state: GameState, dir: Dir): boolean {
  if (state.status !== "running") return false;
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  if (dir === last || dir === OPPOSITE[last]) return false;
  if (state.queue.length >= MAX_QUEUED_TURNS) return false;
  state.queue.push(dir);
  state.inputs.push({ t: state.tick, d: dir });
  return true;
}

/** Advance the simulation by exactly one tick. Mutates and returns `state`. */
export function step(state: GameState, course: Course): GameState {
  state.events = [];
  if (state.status !== "running") return state;

  state.tick++;
  state.moveCounter++;
  if (state.moveCounter < state.interval) return state;
  state.moveCounter = 0;

  if (state.queue.length) state.dir = state.queue.shift() as Dir;

  const head = state.snake[0];
  const { pos, outOfBounds, tunnel } = nextHeadPosition(course, head, state.dir);

  let crash: DeathReason | null = null;
  if (outOfBounds) crash = "wall";
  else if (tileAt(course, pos.x, pos.y) === Tile.Rock) crash = "rock";
  else {
    // The tail vacates its cell this move (length is fixed), so it doesn't count.
    for (let i = 0; i < state.snake.length - 1; i++) {
      const s = state.snake[i];
      if (s.x === pos.x && s.y === pos.y) {
        crash = "self";
        break;
      }
    }
  }

  if (crash) {
    if (state.tick < state.effects.graceUntil) {
      // Shield grace period: the snake stalls instead of dying, giving time to turn.
      state.prevSnake = state.snake.map((p) => ({ ...p }));
      state.interval = currentInterval(state, course);
      return state;
    }
    if (state.effects.shieldCharges > 0) {
      state.effects.shieldCharges--;
      state.effects.graceUntil = state.tick + SHIELD_GRACE_TICKS;
      state.events.push({ type: "shieldUsed" });
      state.prevSnake = state.snake.map((p) => ({ ...p }));
      state.interval = currentInterval(state, course);
      return state;
    }
    state.status = "dead";
    state.deathReason = crash;
    state.events.push({ type: "dead", reason: crash });
    return state;
  }

  // Move: new head in front, tail removed.
  state.prevSnake = state.snake.map((p) => ({ ...p }));
  state.snake.unshift(pos);
  state.snake.pop();
  state.moves++;
  state.events.push({ type: "move" });
  if (tunnel) state.events.push({ type: "tunnel" });

  // Pickups (activate immediately — same placement for every player).
  course.pickups.forEach((p, i) => {
    if (state.pickupsTaken[i] || p.at.x !== pos.x || p.at.y !== pos.y) return;
    state.pickupsTaken[i] = true;
    if (p.kind === "shield") state.effects.shieldCharges = 1;
    else if (p.kind === "boost") state.effects.boostUntil = state.tick + POWERUP_TICKS.boost;
    else if (p.kind === "magnet") state.effects.magnetUntil = state.tick + POWERUP_TICKS.magnet;
    else if (p.kind === "energy") state.effects.energyUntil = state.tick + POWERUP_TICKS.energy;
    state.events.push({ type: "pickup", kind: p.kind });
  });

  // Apples (magnet widens the pickup radius).
  const radius = state.tick < state.effects.magnetUntil ? MAGNET_RADIUS : 0;
  course.apples.forEach((a, i) => {
    if (state.applesTaken[i]) return;
    if (Math.abs(a.x - pos.x) <= radius && Math.abs(a.y - pos.y) <= radius) {
      state.applesTaken[i] = true;
      state.applesCollected++;
      state.events.push({ type: "apple", index: i });
    }
  });

  if (state.applesCollected === course.apples.length) {
    state.status = "complete";
    state.finishTick = state.tick;
    state.events.push({ type: "complete" });
    return state;
  }

  state.interval = currentInterval(state, course);
  return state;
}

/** Progress (0..1) toward the next move — used only for smooth rendering. */
export function moveProgress(state: GameState): number {
  if (state.status !== "running") return 1;
  return Math.min(1, state.moveCounter / state.interval);
}
