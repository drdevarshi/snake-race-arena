import { CourseBuilder, parseCourse, type CourseSource } from "../course";
import type { Course } from "../types";

/* -------------------------------------------------------------------------
 * Training Grounds — small, slow, introduces every mechanic.
 * ---------------------------------------------------------------------- */
function trainingGrounds(): CourseSource {
  const b = new CourseBuilder(32, 20).border();
  // River down the middle with two bridges
  b.rect(15, 1, 3, 18, "~");
  b.replace(15, 5, 3, 2, "~", "=");
  b.replace(15, 13, 3, 2, "~", "=");
  // Rocks
  b.rect(5, 4, 3, 1, "#").rect(5, 4, 1, 3, "#");
  b.rect(24, 13, 3, 1, "#").rect(26, 11, 1, 3, "#");
  b.rect(8, 14, 4, 1, "#");
  b.rect(21, 3, 1, 4, "#");
  // Tunnel between the far corners
  b.set(3, 17, "1").set(28, 2, "1");
  // Apples (10)
  [[4, 2], [10, 8], [12, 16], [16, 3], [20, 5], [27, 7], [22, 16], [29, 17], [6, 11], [16, 10]].forEach(([x, y]) => b.set(x, y, "@"));
  // Power-ups
  b.set(9, 3, "B").set(22, 9, "H").set(12, 12, "M").set(13, 9, "E");
  b.set(6, 9, "S");
  return { id: "training-grounds", nameKey: "game.courses.training-grounds", startDir: "R", snakeLength: 5, defaultSpeed: "slow", rows: b.rows() };
}

/* -------------------------------------------------------------------------
 * Neon Valley — full-size course: meandering river, three bridges,
 * two crossing tunnels and rock clusters.
 * ---------------------------------------------------------------------- */
function neonValley(): CourseSource {
  const W = 56;
  const H = 36;
  const b = new CourseBuilder(W, H).border();
  // Meandering river (integer math only — must be identical everywhere)
  const offsets = [0, 1, 1, 2, 2, 3, 3, 3, 2, 2, 1, 1, 0, -1, -1, -2, -2, -3, -3, -3, -2, -2, -1, -1];
  for (let x = 1; x < W - 1; x++) {
    const c = 17 + offsets[x % offsets.length];
    b.rect(x, c - 1, 1, 3, "~");
  }
  b.replace(10, 1, 2, H - 2, "~", "=");
  b.replace(30, 1, 2, H - 2, "~", "=");
  b.replace(46, 1, 2, H - 2, "~", "=");
  // Rock clusters
  b.rect(6, 5, 6, 2, "#");
  b.rect(20, 4, 2, 8, "#");
  b.rect(38, 6, 8, 2, "#").rect(44, 8, 2, 6, "#");
  b.rect(8, 26, 2, 6, "#");
  b.rect(16, 28, 10, 2, "#");
  b.rect(36, 25, 2, 7, "#");
  b.rect(40, 29, 8, 2, "#");
  b.rect(27, 24, 1, 8, "#");
  b.rect(50, 24, 3, 2, "#");
  // Tunnels: corners cross diagonally
  b.set(3, 3, "1").set(52, 32, "1");
  b.set(52, 3, "2").set(3, 32, "2");
  // Apples (10)
  [[14, 8], [30, 6], [50, 10], [24, 15], [4, 20], [48, 22], [12, 23], [22, 32], [44, 33], [33, 27]].forEach(([x, y]) => b.set(x, y, "@"));
  // Power-ups
  b.set(18, 21, "B").set(28, 3, "H").set(40, 14, "M").set(8, 15, "E");
  b.set(9, 12, "S");
  return { id: "neon-valley", nameKey: "game.courses.neon-valley", startDir: "R", snakeLength: 6, defaultSpeed: "normal", rows: b.rows() };
}

const SOURCES: CourseSource[] = [trainingGrounds(), neonValley()];

const cache = new Map<string, Course>();

export function getCourse(id: string): Course | null {
  if (cache.has(id)) return cache.get(id)!;
  const src = SOURCES.find((s) => s.id === id);
  if (!src) return null;
  const course = parseCourse(src);
  cache.set(id, course);
  return course;
}

export function listCourseIds(): string[] {
  return SOURCES.map((s) => s.id);
}

export function getCourseSource(id: string): CourseSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

export const DEFAULT_COURSE_ID = "training-grounds";
