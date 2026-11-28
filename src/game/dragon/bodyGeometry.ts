import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Sphere, Vector3 } from "three";
import type { Frame, Vec3 } from "./bodyPath";

/** Vertices around each body ring. 24 matches the head asset contract's neck ring. */
export const RADIAL = 24;

/**
 * Builds the body tube: `rings` cross-sections of RADIAL vertices (plus one seam column so the
 * scale texture wraps cleanly) and a single tail-tip vertex. The neck end is left open; the
 * head's neck socket covers it.
 *
 * Static attributes: uv (x = around, 0 = spine and 0.5 = belly; y = distance along the body in
 * scale units) and aAlong (0 = neck, 1 = tail). Positions and normals are rewritten every frame.
 */
export function createBodyGeometry(rings: number, spacing: number, scaleSize: number): BufferGeometry {
  const cols = RADIAL + 1;
  const vertCount = rings * cols + 1;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const along = new Float32Array(vertCount);

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j;
      uvs[k * 2] = j / RADIAL;
      uvs[k * 2 + 1] = (i * spacing) / scaleSize;
      along[k] = i / (rings - 1);
    }
  }
  const tip = rings * cols;
  uvs[tip * 2] = 0.5;
  uvs[tip * 2 + 1] = (rings * spacing) / scaleSize;
  along[tip] = 1;

  const index: number[] = [];
  for (let i = 0; i + 1 < rings; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      // Counter-clockwise seen from outside: (θ step) × (towards tail) points along the outward normal.
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const last = (rings - 1) * cols;
  for (let j = 0; j < RADIAL; j++) index.push(last + j, tip, last + j + 1);

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  g.setAttribute("normal", new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setAttribute("aAlong", new BufferAttribute(along, 1));
  g.setIndex(index);
  // The body moves every frame; a generous fixed bound avoids recomputing it and wrong culling.
  g.boundingSphere = new Sphere(new Vector3(0, 0, 0), 50);
  return g;
}

/**
 * Rewrites positions and normals from sampled points, frames and radii (index 0 = neck).
 * The cross-section is a slightly flattened ellipse with a flatter belly, like a real serpent.
 */
export function updateBodyGeometry(g: BufferGeometry, points: Vec3[], frames: Frame[], radii: number[]): void {
  const pos = g.getAttribute("position") as BufferAttribute;
  const nor = g.getAttribute("normal") as BufferAttribute;
  const P = pos.array as Float32Array;
  const N = nor.array as Float32Array;
  const rings = points.length;
  const cols = RADIAL + 1;

  for (let i = 0; i < rings; i++) {
    const p = points[i];
    const { n, b } = frames[i];
    const r = radii[i];
    for (let j = 0; j < cols; j++) {
      const th = ((j % RADIAL) / RADIAL) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      // Width 1.0, height 0.88 above, 0.7 below (flatter belly).
      const up = c >= 0 ? 0.88 : 0.7;
      const ox = c * up;
      const oy = s;
      const k = (i * cols + j) * 3;
      P[k] = p.x + r * (ox * n.x + oy * b.x);
      P[k + 1] = p.y + r * (ox * n.y + oy * b.y);
      P[k + 2] = p.z + r * (ox * n.z + oy * b.z);
      // Ellipse normal: (c / up, s), normalised.
      const nx = c / up;
      const len = Math.hypot(nx, s);
      N[k] = (nx * n.x + s * b.x) / len;
      N[k + 1] = (nx * n.y + s * b.y) / len;
      N[k + 2] = (nx * n.z + s * b.z) / len;
    }
  }
  // Tail tip: a little past the last ring, along the body direction.
  const lastP = points[rings - 1];
  const lastT = frames[rings - 1].t;
  const tipLen = radii[rings - 1] * 2.5;
  const k = rings * cols * 3;
  P[k] = lastP.x - lastT.x * tipLen;
  P[k + 1] = lastP.y - lastT.y * tipLen;
  P[k + 2] = lastP.z - lastT.z * tipLen;
  N[k] = -lastT.x;
  N[k + 1] = -lastT.y;
  N[k + 2] = -lastT.z;

  pos.needsUpdate = true;
  nor.needsUpdate = true;
}
