import { describe, expect, it, vi } from "vitest";
import { BufferGeometry, Color, Group, Material, Mesh, type Object3D } from "three";
import { build, type Built } from "./dragonBuild";
import { liveResources } from "./resources";
import { QUALITY_ORDER } from "./quality";
import { SKINS } from "./skins";

/** Every distinct geometry and material reachable from the dragon's scene objects. */
function collect(b: Built): { geometries: BufferGeometry[]; materials: Material[] } {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const roots: Object3D[] = [b.body, b.ridges, b.fin, b.head.root];
  for (const root of roots) {
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    });
  }
  return { geometries: [...geometries], materials: [...materials] };
}

describe("Dragon build ownership (TB-2)", () => {
  it.each(QUALITY_ORDER)("disposes every geometry and material exactly once on %s quality", (q) => {
    const b = build("neon-magenta", q);
    const { geometries, materials } = collect(b);
    // Representative parts must be among them: body, ridges, fin, skull, jaw, eyes, horns, whiskers.
    expect(geometries).toContain(b.body.geometry);
    expect(geometries).toContain(b.ridges.geometry);
    expect(geometries).toContain(b.fin.geometry);
    for (const name of ["Skull", "Jaw", "Eye_L", "Horns", "Whisker_L"]) expect(b.head.root.getObjectByName(name), name).toBeTruthy();
    expect(materials).toContain(b.bodyMat);
    expect(materials).toContain(b.head.eyeMaterial);
    expect(materials).toContain(b.head.crystal);
    expect(geometries.length).toBeGreaterThanOrEqual(15);
    expect(materials.length).toBeGreaterThanOrEqual(8);

    const spies = [...geometries, ...materials].map((r) => vi.spyOn(r, "dispose"));
    b.dispose();
    spies.forEach((s, i) => expect(s, `resource ${i}`).toHaveBeenCalledTimes(1));
    b.dispose(); // a second dispose must not dispose anything again
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
  });

  it("detaches every object from the scene before disposing, over 20 cycles on every tier", () => {
    const start = liveResources.count;
    for (let cycle = 0; cycle < 20; cycle++) {
      for (const q of QUALITY_ORDER) {
        const scene = new Group();
        const b = build("neon-magenta", q);
        scene.add(b.body, b.ridges, b.fin, b.head.root);
        const parentsAtDispose: (Object3D | null)[] = [];
        const bodyDispose = b.body.geometry.dispose.bind(b.body.geometry);
        vi.spyOn(b.body.geometry, "dispose").mockImplementation(() => {
          // At the moment of disposal nothing may still be in the scene, or it would be re-uploaded.
          parentsAtDispose.push(b.body.parent, b.ridges.parent, b.fin.parent, b.head.root.parent);
          bodyDispose();
        });
        expect(liveResources.count).toBeGreaterThan(start);
        b.dispose();
        expect(parentsAtDispose).toEqual([null, null, null, null]);
        expect(scene.children).toHaveLength(0);
        expect(liveResources.count).toBe(start);
      }
    }
  });
});

/** Every colour a skin controls, for each mesh in scene order: [label, r, g, b][]. */
function skinColours(b: Built): [string, number, number, number][] {
  const out: [string, number, number, number][] = [];
  const push = (label: string, c: { r: number; g: number; b: number }) => out.push([label, c.r, c.g, c.b]);
  for (const root of [b.body, b.ridges, b.fin, b.head.root] as Object3D[]) {
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const label = `${o.name || o.type}:${m.type}`;
        const u = (m as { uniforms?: Record<string, { value: unknown }> }).uniforms;
        if (u) for (const k of ["uGlow", "uHighlight", "uBody", "uBelly", "uHot", "uDragonLightColor"]) push(`${label}.${k}`, u[k].value as Color);
        if ("color" in m) push(`${label}.color`, (m as unknown as { color: Color }).color);
        if ("emissive" in m) push(`${label}.emissive`, (m as unknown as { emissive: Color }).emissive);
      }
    });
  }
  return out;
}

describe("skin switching", () => {
  it.each([
    ["neon-magenta", "electric-cyan"],
    ["neon-magenta", "neon-emerald"],
    ["electric-cyan", "neon-magenta"],
  ] as const)("switching %s → %s matches a fresh build in the new skin", (from, to) => {
    const switched = build(from, "medium");
    const before = skinColours(switched);
    switched.applySkin(SKINS[to]);
    const fresh = build(to, "medium");
    const after = skinColours(switched);
    expect(after).toEqual(skinColours(fresh));
    // Every part named in the review must actually have changed colour.
    const changed = (label: string) => after.some(([l, ...c], i) => l.startsWith(label) && c.join() !== before[i].slice(1).join());
    for (const part of ["Skull", "JawScales", "Horn_L", "Brow_L", "Eye_L_Glow", "Whisker_L_Strand", "Nostril_L", "MouthGlow", "Fang_L"]) {
      expect(changed(part), part).toBe(true);
    }
    switched.dispose();
    fresh.dispose();
  });
});
