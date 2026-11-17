import { DIRS, OPPOSITE, Tile, type Course, type Dir, type Point, type PowerUpKind, type SpeedSetting } from "./types";

/**
 * Courses are authored as ASCII grids. Legend:
 *   .  ground          #  rock / wall       ~  water (slow)     =  bridge
 *   S  snake start     @  apple             1-9  tunnel mouths (each digit appears exactly twice)
 *   B  speed boost     H  safety shield     M  apple magnet     E  extra energy
 * Anything outside the grid is a wall.
 */
export interface CourseSource {
  id: string;
  nameKey: string;
  startDir: Dir;
  snakeLength: number;
  defaultSpeed: SpeedSetting;
  rows: string[];
}

const PICKUP_CHARS: Record<string, PowerUpKind> = { B: "boost", H: "shield", M: "magnet", E: "energy" };

export class CourseError extends Error {}

export function parseCourse(src: CourseSource): Course {
  const height = src.rows.length;
  const width = src.rows[0]?.length ?? 0;
  if (!width || !height) throw new CourseError(`${src.id}: empty course`);

  const tiles: Tile[] = new Array(width * height).fill(Tile.Ground);
  const tunnelCells = new Map<number, number[]>();
  const apples: Point[] = [];
  const pickups: Course["pickups"] = [];
  let start: Point | null = null;

  src.rows.forEach((row, y) => {
    if (row.length !== width) throw new CourseError(`${src.id}: row ${y} has length ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const i = y * width + x;
      switch (ch) {
        case ".":
          break;
        case "#":
          tiles[i] = Tile.Rock;
          break;
        case "~":
          tiles[i] = Tile.Water;
          break;
        case "=":
          tiles[i] = Tile.Bridge;
          break;
        case "S":
          if (start) throw new CourseError(`${src.id}: multiple starts`);
          start = { x, y };
          break;
        case "@":
          apples.push({ x, y });
          break;
        default:
          if (ch >= "1" && ch <= "9") {
            tiles[i] = Tile.Tunnel;
            const n = Number(ch);
            tunnelCells.set(n, [...(tunnelCells.get(n) ?? []), i]);
          } else if (PICKUP_CHARS[ch]) {
            pickups.push({ kind: PICKUP_CHARS[ch], at: { x, y } });
          } else {
            throw new CourseError(`${src.id}: unknown char '${ch}' at ${x},${y}`);
          }
      }
    }
  });

  if (!start) throw new CourseError(`${src.id}: no start`);
  if (apples.length === 0) throw new CourseError(`${src.id}: no apples`);

  const tunnels = new Map<number, number>();
  const tunnelLabels = new Map<number, number>();
  for (const [n, cells] of tunnelCells) {
    if (cells.length !== 2) throw new CourseError(`${src.id}: tunnel ${n} must have exactly 2 mouths`);
    tunnels.set(cells[0], cells[1]);
    tunnels.set(cells[1], cells[0]);
    tunnelLabels.set(cells[0], n);
    tunnelLabels.set(cells[1], n);
  }

  // The starting body extends behind the head and must be on safe, non-tunnel ground.
  const s = start as Point;
  const back = DIRS[OPPOSITE[src.startDir]];
  for (let k = 0; k < src.snakeLength; k++) {
    const x = s.x + back.x * k;
    const y = s.y + back.y * k;
    const t = x >= 0 && y >= 0 && x < width && y < height ? tiles[y * width + x] : Tile.Rock;
    if (t === Tile.Rock || t === Tile.Tunnel) throw new CourseError(`${src.id}: starting body blocked at ${x},${y}`);
  }

  return {
    id: src.id,
    nameKey: src.nameKey,
    width,
    height,
    tiles,
    tunnels,
    tunnelLabels,
    start: s,
    startDir: src.startDir,
    snakeLength: src.snakeLength,
    apples,
    pickups,
    defaultSpeed: src.defaultSpeed,
  };
}

/* ------------------------------------------------------------------------
 * Builder: lets courses be described with drawing commands instead of
 * hand-typing large grids (fewer typos). Produces rows for parseCourse().
 * --------------------------------------------------------------------- */
export class CourseBuilder {
  private grid: string[][];
  constructor(public readonly width: number, public readonly height: number) {
    this.grid = Array.from({ length: height }, () => Array.from({ length: width }, () => "."));
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.grid[y][x] = ch;
    return this;
  }
  get(x: number, y: number) {
    return this.grid[y]?.[x];
  }
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
    return this;
  }
  border(ch = "#") {
    this.rect(0, 0, this.width, 1, ch).rect(0, this.height - 1, this.width, 1, ch);
    this.rect(0, 0, 1, this.height, ch).rect(this.width - 1, 0, 1, this.height, ch);
    return this;
  }
  /** Replace `from` with `to` inside a rectangle (e.g. turn water into a bridge). */
  replace(x: number, y: number, w: number, h: number, from: string, to: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j) === from) this.set(i, j, to);
    return this;
  }
  rows(): string[] {
    return this.grid.map((r) => r.join(""));
  }
}
