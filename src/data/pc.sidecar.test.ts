import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyExplode, buildPlan } from "@/engine/explode/plan";
import { PART_NAMES, buildPc } from "@/models/pc/build-pc";
import { pcCopy, pcSidecar } from "./pc";

/** World boxes of every mesh in each part, shrunk a hair so parts that merely touch do not count. */
function meshBoxes(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const out: { part: string; box: THREE.Box3 }[] = [];
  for (const id of PART_NAMES) {
    root.getObjectByName(id)!.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.userData.holed) return;
      if (!o.userData.cable) {
        out.push({ part: id, box: new THREE.Box3().setFromObject(o).expandByScalar(-0.006) });
        return;
      }
      // A cable's one box would span everything it curves around: measure it in short lengths.
      const pos = mesh.geometry.getAttribute("position");
      const ring = (mesh.geometry as THREE.TubeGeometry).parameters.radialSegments + 1;
      const v = new THREE.Vector3();
      for (let start = 0; start < pos.count; start += ring * 2) {
        const b = new THREE.Box3();
        for (let i = start; i < Math.min(start + ring * 3, pos.count); i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
        out.push({ part: id, box: b.expandByScalar(-0.006) });
      }
    });
  }
  return out;
}

/** Pairs of parts with at least one pair of intersecting mesh boxes, as "a|b" keys. */
function clashes(root: THREE.Object3D) {
  const boxes = meshBoxes(root);
  const pairs = new Set<string>();
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.part !== b.part && a.box.intersectsBox(b.box)) pairs.add([a.part, b.part].sort().join("|"));
    }
  return pairs;
}

describe("pc sidecar", () => {
  it("names every model part, authors a vector for each, and has copy for each", () => {
    expect(Object.keys(pcSidecar.parts)).toEqual([...PART_NAMES]);
    for (const [id, part] of Object.entries(pcSidecar.parts)) {
      expect(part.explode, id).toBeDefined();
      expect(pcCopy[part.copy]?.label, id).toBe(part.label);
    }
    expect(Object.keys(pcSidecar.groups)).toEqual(["chassis", "board", "compute", "graphics", "storage", "power", "cooling"]);
    for (const id of ["cpu", "gpu", "motherboard"]) expect(pcSidecar.parts[id].view, id).toBeDefined();
  });

  it("explodes without driving any part through another, and ends with every part clear", () => {
    const { root } = buildPc();
    const plan = buildPlan(root, pcSidecar);
    const atRest = clashes(root);
    for (let k = 0.02; k <= 1.0001; k += 0.02) {
      applyExplode(plan, Math.min(k, 1));
      const now = clashes(root);
      const fresh = [...now].filter((p) => !atRest.has(p));
      expect(fresh, `new contact at k = ${k.toFixed(2)}`).toEqual([]);
    }
    const end = [...clashes(root)].filter((p) => !p.startsWith("case_frame|"));
    expect(end, "parts still touching when fully exploded").toEqual([]);
  });
});
