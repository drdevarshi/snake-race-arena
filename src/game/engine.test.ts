import { describe, expect, it } from "vitest";
import { applyInput, createGame, nextHeadPosition, step, tileAt } from "./engine";
import { replay } from "./replay";
import { getCourse, listCourseIds } from "./courses";
import { parseCourse } from "./course";
import { DIRS, OPPOSITE, Tile, type Course, type Dir, type GameState, type Point } from "./types";

const ALL_DIRS: Dir[] = ["U", "R", "D", "L"];
const key = (p: Point) => `${p.x},${p.y}`;

/** BFS over the movement graph (with tunnels) avoiding rocks and the given blocked cells. */
function bfsFirstStep(course: Course, from: Point, facing: Dir, targets: Set<string>, blocked: Set<string>): Dir | null {
  const q: { p: Point; first: Dir | null; facing: Dir }[] = [{ p: from, first: null, facing }];
  const seen = new Set([key(from)]);
  while (q.length) {
    const cur = q.shift()!;
    for (const d of ALL_DIRS) {
      if (d === OPPOSITE[cur.facing]) continue;
      const { pos, outOfBounds } = nextHeadPosition(course, cur.p, d);
      if (outOfBounds || tileAt(course, pos.x, pos.y) === Tile.Rock) continue;
      const k = key(pos);
      if (seen.has(k) || (cur.first === null && blocked.has(k))) continue;
      seen.add(k);
      const first = cur.first ?? d;
      if (targets.has(k)) return first;
      q.push({ p: pos, first, facing: d });
    }
  }
  return null;
}

/** Simple bot: before each move, steer toward the nearest remaining apple. */
function playWithBot(course: Course): GameState {
  const s = createGame(course);
  for (let guard = 0; guard < 200_000 && s.status === "running"; guard++) {
    if (s.moveCounter === s.interval - 1 && s.queue.length === 0) {
      const targets = new Set(course.apples.filter((_, i) => !s.applesTaken[i]).map(key));
      const body = new Set(s.snake.slice(0, -1).map(key));
      const d = bfsFirstStep(course, s.snake[0], s.dir, targets, body);
      if (d && d !== s.dir) applyInput(s, d);
    }
    step(s, course);
  }
  return s;
}

describe.each(listCourseIds())("course %s", (id) => {
  const course = getCourse(id)!;

  it("parses with 10 apples and paired tunnels", () => {
    expect(course.apples).toHaveLength(10);
    expect(course.tunnels.size % 2).toBe(0);
  });

  it("every apple and power-up is reachable from the start", () => {
    for (const target of [...course.apples, ...course.pickups.map((p) => p.at)]) {
      const d = bfsFirstStep(course, course.start, course.startDir, new Set([key(target)]), new Set());
      expect(d, `unreachable ${key(target)}`).not.toBeNull();
    }
  });

  it("a bot can complete the course, and replaying its inputs gives the identical time", () => {
    const live = playWithBot(course);
    expect(live.status).toBe("complete");
    const r = replay(course, live.speed, live.inputs);
    expect(r.valid).toBe(true);
    expect(r.status).toBe("complete");
    expect(r.ticks).toBe(live.tick);
    expect(r.timeMs).toBe(live.finishTick! * 20);
    // eslint-disable-next-line no-console
    console.log(`${id}: bot finished in ${r.timeMs} ms with ${live.inputs.length} inputs`);
  });
});

describe("engine rules", () => {
  const tiny = parseCourse({
    id: "t",
    nameKey: "t",
    startDir: "R",
    snakeLength: 3,
    defaultSpeed: "normal",
    rows: [
      "##########",
      "#...S.@..#",
      "#~~~~~~~~#",
      "#1......1#",
      "##########",
    ],
  });

  it("dies on wall collision with no input", () => {
    // turn down: through water, then into the bottom wall
    const r = replay(tiny, "normal", [{ t: 0, d: "D" }]);
    expect(r.valid).toBe(true);
    expect(r.status).toBe("dead");
    expect(r.deathReason).toBe("rock");
  });

  it("collects an apple and completes", () => {
    const s = createGame(tiny);
    while (s.status === "running") step(s, tiny);
    expect(s.applesCollected).toBe(1);
    expect(s.status).toBe("complete");
    expect(s.snake).toHaveLength(3); // length never changes
  });

  it("ignores 180° reversals", () => {
    const s = createGame(tiny);
    expect(applyInput(s, "L")).toBe(false);
    expect(applyInput(s, "R")).toBe(false);
    expect(applyInput(s, "D")).toBe(true);
    expect(s.inputs).toEqual([{ t: 0, d: "D" }]);
  });

  it("water doubles the move interval", () => {
    const s = createGame(tiny);
    applyInput(s, "D");
    while (s.snake[0].y !== 2) step(s, tiny);
    expect(tileAt(tiny, s.snake[0].x, s.snake[0].y)).toBe(Tile.Water);
    expect(s.interval).toBe(12);
  });

  it("tunnels teleport to the paired mouth", () => {
    const course = parseCourse({
      id: "tun", nameKey: "t", startDir: "D", snakeLength: 2, defaultSpeed: "normal",
      rows: ["#####", "#...#", "#.S.#", "#.1.#", "#...#", "#..1#", "#.@.#", "#####"],
    });
    const s = createGame(course);
    // Start (2,2) facing down → next cell (2,3) is tunnel 1 → exits at (3,5)
    while (s.moves < 1) step(s, course);
    expect(s.snake[0]).toEqual({ x: 3, y: 5 });
  });

  it("shield absorbs one crash", () => {
    const course = parseCourse({
      id: "sh", nameKey: "t", startDir: "R", snakeLength: 2, defaultSpeed: "normal",
      rows: ["######", "#.SH.#", "#...@#", "######"],
    });
    const s = createGame(course);
    while (s.status === "running" && s.tick < 200) step(s, course);
    // picks shield at (3,1), hits wall at (5,1)... shield absorbs, then grace stalls, then dies
    expect(s.effects.shieldCharges).toBe(0);
    expect(s.status).toBe("dead");
    const s2 = createGame(course);
    while (s2.snake[0].x !== 4) step(s2, course);
    // with the shield used, the player can turn down to the apple
    while (s2.effects.graceUntil === 0) step(s2, course);
    applyInput(s2, "D");
    while (s2.status === "running") step(s2, course);
    expect(s2.status).toBe("complete");
  });
});

describe("replay anti-tamper", () => {
  const course = getCourse("training-grounds")!;
  it("rejects malformed logs", () => {
    expect(replay(course, "slow", "nope").error).toBe("BAD_FORMAT");
    expect(replay(course, "slow", [{ t: -1, d: "U" }]).error).toBe("BAD_FORMAT");
    expect(replay(course, "slow", [{ t: 1.5, d: "U" }]).error).toBe("BAD_FORMAT");
    expect(replay(course, "slow", [{ t: 1, d: "X" }]).error).toBe("BAD_FORMAT");
  });
  it("rejects out-of-order and impossible inputs", () => {
    expect(replay(course, "slow", [{ t: 5, d: "U" }, { t: 2, d: "L" }]).error).toBe("OUT_OF_ORDER");
    expect(replay(course, "slow", [{ t: 0, d: "L" }]).error).toBe("INPUT_REJECTED"); // reversal
  });
  it("rejects inputs after the run ended", () => {
    expect(replay(course, "slow", [{ t: 999_999, d: "U" }]).error).toBe("INPUT_AFTER_END");
  });
  it("a tampered time cannot be produced: changing speed changes the result", () => {
    const live = playWithBot(course);
    const fast = replay(course, "fast", live.inputs);
    expect(fast.timeMs === live.finishTick! * 20 && fast.status === "complete").toBe(false);
  });
});

// keep DIRS import used for type-checkers
void DIRS;
