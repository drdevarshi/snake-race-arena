/**
 * Canvas renderer for the Snake engine. Visual only — never mutates game state.
 * The static board is pre-rendered once to an offscreen canvas; each frame draws
 * the visible slice plus dynamic objects (water shimmer, apples, power-ups, snake).
 */
import { moveProgress, tileAt } from "@/game/engine";
import { Tile, type Course, type GameState, type Point, type PowerUpKind } from "@/game/types";

const TEX = 32; // texture pixels per cell in the cached board

export const COLORS = {
  ground: "#0a1410",
  groundAlt: "#0c1813",
  gridLine: "rgba(0,240,255,0.05)",
  rock: "#2a2f3d",
  rockTop: "#3b4254",
  rockEdge: "rgba(157,77,255,0.55)",
  water: "#0b2e5c",
  waterLight: "rgba(0,240,255,0.25)",
  bridge: "#5a3d22",
  bridgePlank: "#7a5532",
  bridgeEdge: "#ffc832",
  tunnel: "#9d4dff",
  apple: "#ff3355",
  snake: "#39ff14",
  snakeHead: "#a6ff00",
  shield: "#00f0ff",
};

export const PICKUP_STYLE: Record<PowerUpKind, { color: string; glyph: string }> = {
  boost: { color: "#ffc832", glyph: "bolt" },
  shield: { color: "#00f0ff", glyph: "shield" },
  magnet: { color: "#ff2bd6", glyph: "magnet" },
  energy: { color: "#39ff14", glyph: "battery" },
};

/* ----------------------------- board cache ------------------------------ */

export function buildBoard(course: Course): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = course.width * TEX;
  c.height = course.height * TEX;
  const g = c.getContext("2d")!;

  for (let y = 0; y < course.height; y++) {
    for (let x = 0; x < course.width; x++) {
      const px = x * TEX;
      const py = y * TEX;
      const t = tileAt(course, x, y);
      // ground everywhere first (checker)
      g.fillStyle = (x + y) % 2 ? COLORS.ground : COLORS.groundAlt;
      g.fillRect(px, py, TEX, TEX);

      if (t === Tile.Water || t === Tile.Bridge) {
        g.fillStyle = COLORS.water;
        g.fillRect(px, py, TEX, TEX);
      }
      if (t === Tile.Bridge) {
        g.fillStyle = COLORS.bridge;
        g.fillRect(px, py + 2, TEX, TEX - 4);
        g.fillStyle = COLORS.bridgePlank;
        for (let k = 0; k < 4; k++) g.fillRect(px + 2 + k * 8, py + 3, 5, TEX - 6);
        const waterAbove = tileAt(course, x, y - 1) === Tile.Water;
        const waterBelow = tileAt(course, x, y + 1) === Tile.Water;
        const waterLeft = tileAt(course, x - 1, y) === Tile.Water;
        const waterRight = tileAt(course, x + 1, y) === Tile.Water;
        g.fillStyle = COLORS.bridgeEdge;
        if (waterLeft || waterRight) {
          g.fillRect(px, py + 1, TEX, 2);
          g.fillRect(px, py + TEX - 3, TEX, 2);
        }
        if (waterAbove || waterBelow) {
          g.fillRect(px + 1, py, 2, TEX);
          g.fillRect(px + TEX - 3, py, 2, TEX);
        }
      }
      if (t === Tile.Rock) {
        const border = x === 0 || y === 0 || x === course.width - 1 || y === course.height - 1;
        g.fillStyle = border ? "#151a26" : COLORS.rock;
        g.fillRect(px, py, TEX, TEX);
        g.fillStyle = border ? "#1d2333" : COLORS.rockTop;
        g.beginPath();
        g.moveTo(px + 4, py + TEX - 6);
        g.lineTo(px + 10, py + 6);
        g.lineTo(px + 22, py + 4);
        g.lineTo(px + TEX - 4, py + 16);
        g.lineTo(px + TEX - 6, py + TEX - 4);
        g.closePath();
        g.fill();
        // neon edge only where rock meets open ground
        g.strokeStyle = COLORS.rockEdge;
        g.lineWidth = 2;
        const open = (dx: number, dy: number) => tileAt(course, x + dx, y + dy) !== Tile.Rock;
        g.beginPath();
        if (open(0, -1)) { g.moveTo(px, py + 1); g.lineTo(px + TEX, py + 1); }
        if (open(0, 1)) { g.moveTo(px, py + TEX - 1); g.lineTo(px + TEX, py + TEX - 1); }
        if (open(-1, 0)) { g.moveTo(px + 1, py); g.lineTo(px + 1, py + TEX); }
        if (open(1, 0)) { g.moveTo(px + TEX - 1, py); g.lineTo(px + TEX - 1, py + TEX); }
        g.stroke();
      }
    }
  }

  // faint grid
  g.strokeStyle = COLORS.gridLine;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= course.width; x++) { g.moveTo(x * TEX + 0.5, 0); g.lineTo(x * TEX + 0.5, c.height); }
  for (let y = 0; y <= course.height; y++) { g.moveTo(0, y * TEX + 0.5); g.lineTo(c.width, y * TEX + 0.5); }
  g.stroke();

  // tunnel mouths
  for (const [idx, n] of course.tunnelLabels) {
    const x = (idx % course.width) * TEX + TEX / 2;
    const y = Math.floor(idx / course.width) * TEX + TEX / 2;
    const grad = g.createRadialGradient(x, y, 2, x, y, TEX / 2);
    grad.addColorStop(0, "#000");
    grad.addColorStop(0.6, "#2a0d4d");
    grad.addColorStop(1, COLORS.tunnel);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, TEX / 2 - 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e9d5ff";
    g.font = "bold 13px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), x, y + 1);
  }
  return c;
}

/* ------------------------------- camera -------------------------------- */

export interface View {
  cellPx: number;
  /** top-left of the viewport in cell units (fractional) */
  camX: number;
  camY: number;
  width: number;
  height: number;
  follows: boolean;
}

const MIN_FIT_CELL = 20;

export function computeView(course: Course, width: number, height: number, focus: Point, prev?: View): View {
  const fit = Math.min(width / course.width, height / course.height);
  if (fit >= MIN_FIT_CELL) {
    return {
      cellPx: fit,
      camX: -(width / fit - course.width) / 2,
      camY: -(height / fit - course.height) / 2,
      width,
      height,
      follows: false,
    };
  }
  const cellPx = Math.max(16, Math.min(30, width / 20));
  const vw = width / cellPx;
  const vh = height / cellPx;
  const clamp = (v: number, size: number, max: number) => (max <= size ? -(size - max) / 2 : Math.min(Math.max(v, 0), max - size));
  let camX = clamp(focus.x + 0.5 - vw / 2, vw, course.width);
  let camY = clamp(focus.y + 0.5 - vh / 2, vh, course.height);
  // light smoothing so teleports don't snap the camera brutally
  if (prev && prev.follows && prev.cellPx === cellPx) {
    const jump = Math.abs(prev.camX - camX) + Math.abs(prev.camY - camY);
    if (jump < 8) {
      camX = prev.camX + (camX - prev.camX) * 0.25;
      camY = prev.camY + (camY - prev.camY) * 0.25;
    }
  }
  return { cellPx, camX, camY, width, height, follows: true };
}

/* ------------------------------- frame --------------------------------- */

/** Interpolated segment positions (cell units). Teleport jumps are not interpolated. */
export function interpolatedSnake(state: GameState): Point[] {
  const a = moveProgress(state);
  return state.snake.map((cur, i) => {
    const prev = state.prevSnake[i] ?? cur;
    if (Math.abs(prev.x - cur.x) + Math.abs(prev.y - cur.y) > 1) return cur;
    return { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a };
  });
}

export function drawFrame(ctx: CanvasRenderingContext2D, board: HTMLCanvasElement, course: Course, state: GameState, view: View, timeMs: number) {
  const { cellPx: cs, camX, camY, width, height } = view;
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, width, height);

  // Board slice
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(board, -camX * cs, -camY * cs, course.width * cs, course.height * cs);

  const toX = (cx: number) => (cx - camX) * cs;
  const toY = (cy: number) => (cy - camY) * cs;
  const x0 = Math.max(0, Math.floor(camX));
  const y0 = Math.max(0, Math.floor(camY));
  const x1 = Math.min(course.width - 1, Math.ceil(camX + width / cs));
  const y1 = Math.min(course.height - 1, Math.ceil(camY + height / cs));

  // Water shimmer (visible cells only)
  ctx.strokeStyle = COLORS.waterLight;
  ctx.lineWidth = Math.max(1, cs / 14);
  ctx.beginPath();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tileAt(course, x, y) !== Tile.Water) continue;
      const phase = timeMs / 400 + x * 0.7 + y * 0.3;
      const ox = toX(x) + cs * (0.2 + 0.15 * Math.sin(phase));
      const oy = toY(y) + cs * (0.35 + 0.25 * ((x + y) % 2));
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + cs * 0.45, oy);
    }
  }
  ctx.stroke();

  // Tunnel glow pulse
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 300);
  ctx.save();
  ctx.shadowColor = COLORS.tunnel;
  ctx.shadowBlur = 8 + 10 * pulse;
  ctx.strokeStyle = `rgba(157,77,255,${0.5 + 0.4 * pulse})`;
  ctx.lineWidth = Math.max(1.5, cs / 12);
  for (const idx of course.tunnelLabels.keys()) {
    const x = idx % course.width;
    const y = Math.floor(idx / course.width);
    ctx.beginPath();
    ctx.arc(toX(x + 0.5), toY(y + 0.5), cs * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Apples
  course.apples.forEach((a, i) => {
    if (state.applesTaken[i]) return;
    const cx = toX(a.x + 0.5);
    const cy = toY(a.y + 0.5);
    const r = cs * (0.3 + 0.03 * Math.sin(timeMs / 200 + i));
    ctx.save();
    ctx.shadowColor = COLORS.apple;
    ctx.shadowBlur = cs * 0.6;
    ctx.fillStyle = COLORS.apple;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.25, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.snake;
    ctx.lineWidth = Math.max(1.5, cs / 14);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.8);
    ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 1.3, cx + r * 0.6, cy - r * 1.3);
    ctx.stroke();
  });

  // Power-up pickups
  course.pickups.forEach((p, i) => {
    if (state.pickupsTaken[i]) return;
    const cx = toX(p.at.x + 0.5);
    const cy = toY(p.at.y + 0.5) + Math.sin(timeMs / 250 + i) * cs * 0.06;
    drawPickupIcon(ctx, p.kind, cx, cy, cs * 0.42);
  });

  // Snake
  drawSnake(ctx, state, toX, toY, cs, timeMs);
}

export function drawPickupIcon(ctx: CanvasRenderingContext2D, kind: PowerUpKind, cx: number, cy: number, r: number) {
  const { color } = PICKUP_STYLE[kind];
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r;
  ctx.fillStyle = "rgba(5,6,10,0.85)";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r / 6);
  ctx.beginPath();
  ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.45);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const s = r * 0.62;
  ctx.beginPath();
  if (kind === "boost") {
    ctx.moveTo(cx + s * 0.2, cy - s);
    ctx.lineTo(cx - s * 0.6, cy + s * 0.15);
    ctx.lineTo(cx, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.2, cy + s);
    ctx.lineTo(cx + s * 0.6, cy - s * 0.15);
    ctx.lineTo(cx, cy - s * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "shield") {
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.8, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.7, cy + s * 0.2);
    ctx.quadraticCurveTo(cx + s * 0.4, cy + s * 0.8, cx, cy + s);
    ctx.quadraticCurveTo(cx - s * 0.4, cy + s * 0.8, cx - s * 0.7, cy + s * 0.2);
    ctx.lineTo(cx - s * 0.8, cy - s * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "magnet") {
    ctx.lineWidth = s * 0.45;
    ctx.lineCap = "butt";
    ctx.arc(cx, cy, s * 0.6, Math.PI, 0, true);
    ctx.moveTo(cx - s * 0.6, cy);
    ctx.lineTo(cx - s * 0.6, cy - s * 0.8);
    ctx.moveTo(cx + s * 0.6, cy);
    ctx.lineTo(cx + s * 0.6, cy - s * 0.8);
    ctx.stroke();
  } else {
    ctx.fillRect(cx - s * 0.45, cy - s * 0.75, s * 0.9, s * 1.6);
    ctx.fillRect(cx - s * 0.2, cy - s, s * 0.4, s * 0.3);
    ctx.fillStyle = "rgba(5,6,10,0.85)";
    ctx.fillRect(cx - s * 0.3, cy - s * 0.6, s * 0.6, s * 0.5);
  }
  ctx.restore();
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  toX: (n: number) => number,
  toY: (n: number) => number,
  cs: number,
  timeMs: number,
) {
  const pts = interpolatedSnake(state);
  const dead = state.status === "dead";
  const boosting = state.tick < state.effects.boostUntil;
  const graceBlink = state.tick < state.effects.graceUntil && Math.floor(timeMs / 90) % 2 === 0;
  const body = dead ? "#5b6b55" : COLORS.snake;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = dead ? "transparent" : boosting ? "#ffc832" : COLORS.snake;
  ctx.shadowBlur = cs * (boosting ? 0.9 : 0.5);
  if (graceBlink) ctx.globalAlpha = 0.45;

  // Draw tail → head as runs of adjacent segments (break across tunnel jumps)
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i];
    const b = pts[i - 1];
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1.01) continue;
    const k = 1 - i / pts.length;
    ctx.strokeStyle = body;
    ctx.globalAlpha = (graceBlink ? 0.45 : 1) * (0.55 + 0.45 * k);
    ctx.lineWidth = cs * (0.42 + 0.3 * k);
    ctx.beginPath();
    ctx.moveTo(toX(a.x + 0.5), toY(a.y + 0.5));
    ctx.lineTo(toX(b.x + 0.5), toY(b.y + 0.5));
    ctx.stroke();
  }
  // Dots on each segment smooth over gaps (e.g., right after a tunnel)
  pts.forEach((p, i) => {
    const k = 1 - i / pts.length;
    ctx.globalAlpha = (graceBlink ? 0.45 : 1) * (0.55 + 0.45 * k);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(toX(p.x + 0.5), toY(p.y + 0.5), cs * (0.21 + 0.15 * k), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = graceBlink ? 0.45 : 1;

  // Head
  const h = pts[0];
  const hx = toX(h.x + 0.5);
  const hy = toY(h.y + 0.5);
  const ang = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }[state.dir];
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.fillStyle = dead ? "#7c8a74" : COLORS.snakeHead;
  ctx.beginPath();
  ctx.ellipse(cs * 0.05, 0, cs * 0.46, cs * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // eyes
  ctx.fillStyle = "#05060a";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cs * 0.18, side * cs * 0.17, cs * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#00f0ff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cs * 0.21, side * cs * 0.15, cs * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // tongue flick
  if (!dead && Math.sin(timeMs / 140) > 0.4) {
    ctx.strokeStyle = "#ff2bd6";
    ctx.lineWidth = Math.max(1, cs / 16);
    ctx.beginPath();
    ctx.moveTo(cs * 0.48, 0);
    ctx.lineTo(cs * 0.72, 0);
    ctx.lineTo(cs * 0.82, -cs * 0.08);
    ctx.moveTo(cs * 0.72, 0);
    ctx.lineTo(cs * 0.82, cs * 0.08);
    ctx.stroke();
  }
  ctx.restore();

  // Shield bubble
  if (state.effects.shieldCharges > 0 && !dead) {
    ctx.save();
    ctx.strokeStyle = COLORS.shield;
    ctx.shadowColor = COLORS.shield;
    ctx.shadowBlur = cs * 0.6;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(timeMs / 180);
    ctx.lineWidth = Math.max(2, cs / 10);
    ctx.beginPath();
    ctx.arc(hx, hy, cs * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Magnet radius hint
  if (state.tick < state.effects.magnetUntil && !dead) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,43,214,0.35)";
    ctx.setLineDash([cs * 0.2, cs * 0.2]);
    ctx.lineWidth = Math.max(1, cs / 16);
    ctx.strokeRect(toX(Math.round(h.x) - 2), toY(Math.round(h.y) - 2), cs * 5, cs * 5);
    ctx.restore();
  }
}

/* ------------------------------ mini-map ------------------------------- */

export function drawMiniMap(ctx: CanvasRenderingContext2D, board: HTMLCanvasElement, course: Course, state: GameState, view: View | null) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = Math.min(w / course.width, h / course.height);
  const ox = (w - course.width * s) / 2;
  const oy = (h - course.height * s) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(board, ox, oy, course.width * s, course.height * s);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.apple;
  course.apples.forEach((a, i) => {
    if (state.applesTaken[i]) return;
    ctx.beginPath();
    ctx.arc(ox + (a.x + 0.5) * s, oy + (a.y + 0.5) * s, Math.max(1.8, s * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });
  course.pickups.forEach((p, i) => {
    if (state.pickupsTaken[i]) return;
    ctx.fillStyle = PICKUP_STYLE[p.kind].color;
    ctx.fillRect(ox + p.at.x * s, oy + p.at.y * s, Math.max(2, s), Math.max(2, s));
  });
  ctx.fillStyle = COLORS.snake;
  state.snake.forEach((p) => ctx.fillRect(ox + p.x * s, oy + p.y * s, Math.max(2, s), Math.max(2, s)));
  ctx.fillStyle = "#ffffff";
  const hd = state.snake[0];
  ctx.fillRect(ox + hd.x * s - 0.5, oy + hd.y * s - 0.5, Math.max(3, s + 1), Math.max(3, s + 1));

  if (view?.follows) {
    ctx.strokeStyle = "rgba(0,240,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + view.camX * s, oy + view.camY * s, (view.width / view.cellPx) * s, (view.height / view.cellPx) * s);
  }
}
