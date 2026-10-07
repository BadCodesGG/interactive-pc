/**
 * Geometry helpers for the PC: rounded boxes, rounded-edge cylinders, bevelled plates and a `Batch`
 * that merges many placements into one mesh per material.
 *
 * Units: 1 = 100 mm, so a 2 mm steel edge is a radius of 0.02. Every helper here returns geometry
 * whose bounding box is exactly the sharp shape it replaces (the bevel eats into the shape, never out
 * of it), so a part keeps its size when its edges are softened.
 *
 * Source geometries are cached at module level and only ever copied into a `Batch`, never attached to
 * a mesh, so a scene the stage disposes cannot free a buffer another scene still draws with.
 */
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];
export type Axis = "x" | "y" | "z" | "-x" | "-y" | "-z";

const cache = new Map<string, T.BufferGeometry>();
function cached(key: string, make: () => T.BufferGeometry) {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** A box centred on the origin with rounded edges (radius `r`, `seg` segments per corner arc). */
export function rbox(w: number, h: number, d: number, r = 0, seg = 2) {
  return cached(`b${w},${h},${d},${r},${seg}`, () => (r > 0 ? new RoundedBoxGeometry(w, h, d, seg, r) : new T.BoxGeometry(w, h, d)));
}

/** A cylinder along +y, centred on the origin, with both rims rounded by `e`. */
export function cyl(r: number, h: number, e = 0, seg = 24) {
  return cached(`c${r},${h},${e},${seg}`, () => {
    if (e <= 0) return new T.CylinderGeometry(r, r, h, seg);
    const k = Math.min(e, r, h / 2);
    const pts = [new T.Vector2(0, -h / 2)];
    const arc = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 2; i++) {
        const a = a0 + (i / 2) * (Math.PI / 2);
        pts.push(new T.Vector2(cx + k * Math.cos(a), cy + k * Math.sin(a)));
      }
    };
    arc(r - k, -h / 2 + k, -Math.PI / 2);
    arc(r - k, h / 2 - k, 0);
    pts.push(new T.Vector2(0, h / 2));
    return new T.LatheGeometry(pts, seg);
  });
}

/** A thin ring lying in the xz plane: major radius `R`, tube radius `t`. */
export function ring(R: number, t: number, seg = 40) {
  return cached(`r${R},${t},${seg}`, () => new T.TorusGeometry(R, t, 6, seg).rotateX(Math.PI / 2));
}

/** A rounded rectangle outline in (u, v). */
export function rrShape(u0: number, v0: number, u1: number, v1: number, r: number) {
  const s = new T.Shape();
  s.moveTo(u0 + r, v0);
  s.lineTo(u1 - r, v0);
  s.quadraticCurveTo(u1, v0, u1, v0 + r);
  s.lineTo(u1, v1 - r);
  s.quadraticCurveTo(u1, v1, u1 - r, v1);
  s.lineTo(u0 + r, v1);
  s.quadraticCurveTo(u0, v1, u0, v1 - r);
  s.lineTo(u0, v0 + r);
  s.quadraticCurveTo(u0, v0, u0 + r, v0);
  return s;
}

/** A polygon outline in (u, v) from corner pairs. */
export function polyShape(pts: [number, number][]) {
  const s = new T.Shape();
  pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
  s.closePath();
  return s;
}

export const circlePath = (u: number, v: number, r: number) => new T.Path().absarc(u, v, r, 0, Math.PI * 2, true);

/** A rectangular hole from two corners. */
export function rectPath(u0: number, v0: number, u1: number, v1: number) {
  const p = new T.Path();
  p.moveTo(u0, v0);
  p.lineTo(u0, v1);
  p.lineTo(u1, v1);
  p.lineTo(u1, v0);
  p.closePath();
  return p;
}

/** A rounded rectangular hole from two corners. */
export function rrPath(u0: number, v0: number, u1: number, v1: number, r: number) {
  const p = new T.Path();
  p.moveTo(u0 + r, v0);
  p.quadraticCurveTo(u0, v0, u0, v0 + r);
  p.lineTo(u0, v1 - r);
  p.quadraticCurveTo(u0, v1, u0 + r, v1);
  p.lineTo(u1 - r, v1);
  p.quadraticCurveTo(u1, v1, u1, v1 - r);
  p.lineTo(u1, v0 + r);
  p.quadraticCurveTo(u1, v0, u1 - r, v0);
  p.closePath();
  return p;
}

/**
 * A shape extruded along +z from 0 to `depth`, with its edges rounded by `bevel`. The wall keeps the
 * outline exactly and the two faces are inset, so the bounding box is that of the un-bevelled plate;
 * holes get the same rounded lip.
 */
export function slab(shape: T.Shape, depth: number, bevel = 0.006, curveSegments = 16) {
  const b = Math.min(bevel, depth * 0.45);
  const g = new T.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, b);
  return g;
}

/**
 * The same slab lying flat: the shape's (u, v) become world (x, -z) and the thickness runs up +y from
 * 0 to `depth`. Author the outline with v = -z.
 */
export function flatSlab(shape: T.Shape, depth: number, bevel = 0.006, curveSegments = 16) {
  return slab(shape, depth, bevel, curveSegments).rotateX(-Math.PI / 2);
}

const AXES: Record<Axis, T.Vector3> = {
  x: new T.Vector3(1, 0, 0),
  y: new T.Vector3(0, 1, 0),
  z: new T.Vector3(0, 0, 1),
  "-x": new T.Vector3(-1, 0, 0),
  "-y": new T.Vector3(0, -1, 0),
  "-z": new T.Vector3(0, 0, -1),
};
const UP = new T.Vector3(0, 1, 0);
const _q = new T.Quaternion();
const _s = new T.Vector3();

/** A placement: translate to `at`, turn the geometry's +y onto `axis`, optionally scale. */
export function place(at: V3, axis: Axis = "y", scale: number | V3 = 1): T.Matrix4 {
  _q.setFromUnitVectors(UP, AXES[axis]);
  _s.set(...(typeof scale === "number" ? ([scale, scale, scale] as V3) : scale));
  return new T.Matrix4().compose(new T.Vector3(...at), _q, _s);
}

/**
 * Merges placed copies of source geometries into one mesh per material. Positions and normals are
 * copied through the placement matrix; there are no UVs (nothing here is textured).
 */
export class Batch {
  private groups = new Map<T.Material, { pos: number[]; nor: number[]; idx: number[] }>();
  private v = new T.Vector3();

  add(src: T.BufferGeometry, m: T.Matrix4, mat: T.Material) {
    let g = this.groups.get(mat);
    if (!g) this.groups.set(mat, (g = { pos: [], nor: [], idx: [] }));
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const nm = new T.Matrix3().getNormalMatrix(m);
    const base = g.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(m);
      g.pos.push(this.v.x, this.v.y, this.v.z);
      this.v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      g.nor.push(this.v.x, this.v.y, this.v.z);
    }
    const index = src.index;
    if (index) for (let i = 0; i < index.count; i++) g.idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) g.idx.push(base + i);
  }

  /** One geometry per material, in the order the materials were first used. */
  finish(): [T.Material, T.BufferGeometry][] {
    return [...this.groups].map(([mat, g]) => {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(g.pos, 3));
      geometry.setAttribute("normal", new T.Float32BufferAttribute(g.nor, 3));
      geometry.setIndex(g.idx);
      return [mat, geometry];
    });
  }
}
