/**
 * Three scripted 60 s test flights (A4). They are inputs only; the engine decides what happens.
 * The debug panel runs the same logs in the browser, so their hashes can be compared with Node's.
 */
import { encodeInput, NEUTRAL, type InputFrame, type InputLog } from "./controls";

type Step = [seconds: number, input: Partial<InputFrame>];

function build(name: string, size: 12 | 20, steps: Step[]): { name: string; log: InputLog } {
  const changes: [number, number][] = [];
  let tick = 0;
  let last = -1;
  for (const [sec, p] of steps) {
    const code = encodeInput({ ...NEUTRAL, ...p });
    if (code !== last) changes.push([tick, code]);
    last = code;
    tick += sec * 50;
  }
  return { name, log: { version: 1, world: "sandbox-v1", size, ticks: 3000, changes } };
}

export const SCRIPTED_FLIGHTS = [
  // Straight under the deck, then a climbing right turn into the tall pillars.
  build("under-deck-and-pillars", 12, [
    [9, { throttle: 4 }],
    [3, { turn: 6, up: true }],
    [6, { throttle: 8 }],
    [4, { turn: -8 }],
    [8, { throttle: 8, down: true }],
    [10, { turn: 4 }],
    [20, { throttle: -8, turn: -4 }],
  ]),
  // Low slalom through the poles and over the hill, big dragon.
  build("poles-and-hill", 20, [
    [2, { down: true }],
    [5, { throttle: 8, turn: -3 }],
    [6, { turn: 8 }],
    [6, { turn: -8, boost: true }],
    [8, { up: true, turn: 2 }],
    [10, { throttle: -8 }],
    [23, { throttle: 6, turn: -2, down: true }],
  ]),
  // Hover, reverse, steep climb and dive, then circle the world edge.
  build("hover-climb-edge", 12, [
    [4, { throttle: -8 }],
    [6, { up: true }],
    [6, { down: true, throttle: 8 }],
    [4, {}],
    [20, { throttle: 8, boost: true, turn: 1 }],
    [20, { turn: -6 }],
  ]),
];

/**
 * Golden hashes of the three flights. Node's tests and the browser's debug panel must both produce
 * exactly these. If engine tuning changes on purpose, update them in the same commit.
 */
export const GOLDEN: Record<string, string> = {
  "under-deck-and-pillars": "460844fa",
  "poles-and-hill": "ef74a4f3",
  "hover-climb-edge": "5938312f",
};
