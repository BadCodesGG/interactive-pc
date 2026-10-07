/**
 * What every part builder shares: the palette, the RGB colour, the DIMM z positions, and `Kit`, a small
 * builder that collects placed geometry and merges it into one mesh per material when flushed.
 *
 * Materials are cached per kit by (colour, metalness, roughness, tags), so a kit makes one mesh for
 * each surface it uses. Builders author world-space positions; build-pc.ts moves each part's origin to
 * its rest point afterwards.
 *
 * `tags` ride on the material and are copied onto the mesh that uses it:
 *   finish  names a surface for finish.ts when the colour alone would pick the wrong one
 *   holed   the mesh's box covers empty space (an opening, or scattered small pieces), so the
 *           explode clearance test skips it
 *   cable   the build game draws the mesh in along its length
 */
import * as T from "three";
import { Batch, place, rbox, cyl, type Axis, type V3 } from "./geo";
import { material } from "./parts";

export interface Tags {
  finish?: "powder" | "board" | "plastic" | "metal" | "polished" | "mesh" | "cable" | "glass" | "keep";
  holed?: boolean;
  cable?: boolean;
}

export type Surface = readonly [color: string, metalness: number, roughness: number];

/** Finishes. Metalness stays low: a fully metallic surface with nothing to reflect renders nearly black. */
export const PAL = {
  caseSteel: ["#30353d", 0.35, 0.5],
  panel: ["#3b4049", 0.35, 0.4],
  black: ["#1f2227", 0.1, 0.7],
  pcb: ["#1c3a2a", 0.1, 0.65],
  pcbGreen: ["#2a7a4c", 0.15, 0.55],
  gold: ["#e2b85c", 0.5, 0.35],
  silver: ["#c9ced4", 0.4, 0.35],
  alu: ["#c3cacf", 0.45, 0.35],
  copper: ["#d38c58", 0.5, 0.35],
  sink: ["#474e57", 0.4, 0.45],
  sleeve: ["#2a2d33", 0.1, 0.55],
} as const satisfies Record<string, Surface>;

/** One lighting colour, the teal of the site accent, in two strengths: the machine reads as one build. */
export const RGB = { cyan: "#5ad1c7", violet: "#3fb3aa", magenta: "#5ad1c7" };

/** The four DIMM slots' z, front of the board last. */
export const RAM_Z = [-0.32, -0.22, -0.12, -0.02];

export class Kit {
  private batch = new Batch();
  private mats = new Map<string, T.MeshStandardMaterial>();
  constructor(readonly group: T.Group) {}

  /** A cached material; tags go onto the meshes made from it. */
  mat(color: string, metal = 0.2, rough = 0.6, tags?: Tags) {
    const key = `${color}|${metal}|${rough}|${tags ? JSON.stringify(tags) : ""}`;
    let m = this.mats.get(key);
    if (!m) {
      m = material(color, metal, rough);
      if (tags) Object.assign(m.userData, tags);
      this.mats.set(key, m);
    }
    return m;
  }

  /** Same as `mat`, from a palette entry. */
  surface(s: Surface, tags?: Tags) {
    return this.mat(s[0], s[1], s[2], tags);
  }

  /** Places a copy of `geo` (merged into the kit's mesh for `mat`). */
  put(geo: T.BufferGeometry, mat: T.Material, at: V3, axis: Axis = "y", scale: number | V3 = 1) {
    this.batch.add(geo, place(at, axis, scale), mat);
  }

  /** Places a copy under an arbitrary matrix. */
  putM(geo: T.BufferGeometry, mat: T.Material, m: T.Matrix4) {
    this.batch.add(geo, m, mat);
  }

  /** A rounded box of `size` centred at `at`. */
  box(size: V3, at: V3, mat: T.Material, r = 0, seg = 2) {
    this.batch.add(rbox(...size, r, seg), place(at), mat);
  }

  /** A cylinder of radius `r` and `len` along `axis`, rims rounded by `e`. */
  rod(r: number, len: number, at: V3, axis: Axis, mat: T.Material, e = 0, seg = 20) {
    this.batch.add(cyl(r, len, e, seg), place(at, axis), mat);
  }

  /** A standalone mesh (its own geometry, so it keeps its own bounding box). */
  solo(geo: T.BufferGeometry, mat: T.Material, at: V3 = [0, 0, 0], owned = false) {
    const mesh = new T.Mesh(owned ? geo : geo.clone(), mat);
    mesh.position.set(...at);
    Object.assign(mesh.userData, mat.userData);
    this.group.add(mesh);
    return mesh;
  }

  /** Adds one mesh per material used so far to the part's group. */
  flush() {
    for (const [mat, geometry] of this.batch.finish()) {
      const mesh = new T.Mesh(geometry, mat);
      Object.assign(mesh.userData, mat.userData);
      this.group.add(mesh);
    }
    this.batch = new Batch();
    return this;
  }
}

/** A tiny seeded generator so scattered detail is the same on every build. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
