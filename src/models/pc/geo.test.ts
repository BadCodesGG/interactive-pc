import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Batch, cyl, flatSlab, place, polyShape, rbox, rectPath, ring, rrShape, slab } from "./geo";

const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;

/** Does any vertex normal point off every axis, which is what a rounded edge looks like? */
function hasBevel(g: THREE.BufferGeometry) {
  const n = g.getAttribute("normal");
  for (let i = 0; i < n.count; i++) if (Math.max(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))) < 0.95) return true;
  return false;
}

describe("rounded geometry keeps the size of the sharp shape", () => {
  it("rbox has the box's bounds, more than 12 triangles, and normals off the axes", () => {
    const g = rbox(2.2, 0.05, 4.6, 0.02);
    const b = bounds(g);
    expect(b.getSize(new THREE.Vector3()).toArray()).toEqual([2.2, 0.05, 4.6].map((v) => expect.closeTo(v, 6)));
    expect(tris(g)).toBeGreaterThan(12);
    expect(hasBevel(g)).toBe(true);
    // A radius of zero is a plain box, and a radius past half the thinnest side is clamped.
    expect(hasBevel(rbox(1, 1, 1, 0))).toBe(false);
    expect(bounds(rbox(0.05, 1, 1, 0.5)).getSize(new THREE.Vector3()).x).toBeCloseTo(0.05, 6);
  });

  it("cyl has the cylinder's bounds and a rounded rim", () => {
    const g = cyl(0.12, 0.15, 0.03, 20);
    const s = bounds(g).getSize(new THREE.Vector3());
    expect(s.x).toBeCloseTo(0.24, 2);
    expect(s.y).toBeCloseTo(0.15, 6);
    // A rim normal leans between the cap's (up) and the side's (out); a plain cylinder has none.
    const rim = (c: THREE.BufferGeometry) => {
      const n = c.getAttribute("normal");
      for (let i = 0; i < n.count; i++) if (Math.abs(n.getY(i)) > 0.2 && Math.abs(n.getY(i)) < 0.8) return true;
      return false;
    };
    expect(rim(g)).toBe(true);
    expect(rim(cyl(0.12, 0.15, 0, 20))).toBe(false);
  });

  it("slab keeps the outline and depth exactly, holes included, and rounds the edges", () => {
    const shape = polyShape([[-1, 0], [1, 0], [1, 2], [-1, 2]]);
    shape.holes.push(rectPath(-0.5, 0.5, 0.5, 1.5));
    const g = slab(shape, 0.04, 0.008);
    const b = bounds(g);
    expect(b.min.toArray()).toEqual([expect.closeTo(-1, 6), expect.closeTo(0, 6), expect.closeTo(0, 6)]);
    expect(b.max.toArray()).toEqual([expect.closeTo(1, 6), expect.closeTo(2, 6), expect.closeTo(0.04, 6)]);
    expect(hasBevel(g)).toBe(true);
    // The opening still passes light at the wall: no vertex sits inside the hole.
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const inside = Math.abs(p.getX(i)) < 0.499 && p.getY(i) > 0.501 && p.getY(i) < 1.499;
      expect(inside).toBe(false);
    }
  });

  it("flatSlab lies the same plate down: shape v becomes -z and the thickness runs up from y = 0", () => {
    const g = flatSlab(rrShape(-1, -3, 1, 2, 0.1), 0.46, 0.01);
    const b = bounds(g);
    expect(b.min.toArray()).toEqual([expect.closeTo(-1, 6), expect.closeTo(0, 6), expect.closeTo(-2, 6)]);
    expect(b.max.toArray()).toEqual([expect.closeTo(1, 6), expect.closeTo(0.46, 6), expect.closeTo(3, 6)]);
  });

  it("ring lies in the xz plane", () => {
    const b = bounds(ring(0.5, 0.01));
    expect(b.getSize(new THREE.Vector3()).y).toBeLessThan(0.02);
    expect(b.getSize(new THREE.Vector3()).x).toBeCloseTo(1.02, 2);
  });
});

describe("Batch", () => {
  it("merges placed copies into one geometry per material, moving positions and normals", () => {
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    const batch = new Batch();
    batch.add(rbox(1, 1, 1, 0.1, 1), place([0, 0, 0]), a);
    batch.add(rbox(1, 1, 1, 0.1, 1), place([10, 0, 0]), a);
    batch.add(rbox(1, 1, 1), place([0, 5, 0], "x"), b);
    const out = batch.finish();
    expect(out.map(([m]) => m)).toEqual([a, b]);
    const [, ga] = out[0];
    expect(tris(ga)).toBe(2 * tris(rbox(1, 1, 1, 0.1, 1)));
    expect(bounds(ga).min.x).toBeCloseTo(-0.5, 6);
    expect(bounds(ga).max.x).toBeCloseTo(10.5, 6);
    // Every index points at a vertex.
    const count = ga.getAttribute("position").count;
    for (let i = 0; i < ga.index!.count; i++) expect(ga.index!.getX(i)).toBeLessThan(count);
  });

  it("turns +y onto the requested axis", () => {
    const batch = new Batch();
    const m = new THREE.MeshStandardMaterial();
    batch.add(cyl(0.1, 2, 0, 8), place([0, 0, 0], "z"), m);
    const s = bounds(batch.finish()[0][1]).getSize(new THREE.Vector3());
    expect(s.z).toBeCloseTo(2, 6);
    expect(s.y).toBeCloseTo(0.2, 2);
  });
});
