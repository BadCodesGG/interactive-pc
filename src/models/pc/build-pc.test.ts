import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildPc, PART_NAMES, slots } from "./build-pc";
import { cyl } from "./geo";
import { RAM_Z } from "./kit";
import { buildFan } from "./parts";

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe("buildPc", () => {
  it("builds exactly the 18 named parts as direct children of the root, in Node with no DOM", () => {
    const { root, partNames } = buildPc();
    expect(partNames).toEqual(PART_NAMES);
    expect(partNames).toHaveLength(18);
    expect(root.children.map((c) => c.name)).toEqual(partNames);
    const counts = new Map<string, number>();
    root.traverse((o) => counts.set(o.name, (counts.get(o.name) ?? 0) + 1));
    for (const id of partNames) expect(counts.get(id), id).toBe(1);
  });

  it("gives each part real geometry at real proportions (1 unit = 100 mm)", () => {
    const { root } = buildPc();
    const size = (id: string) => box(root.getObjectByName(id)!).getSize(new THREE.Vector3());
    const board = size("motherboard");
    expect(board.y).toBeCloseTo(3.05, 1); // ATX 305 mm tall in a tower
    expect(board.z).toBeGreaterThanOrEqual(2.44); // 244 mm wide, plus the I/O ports overhanging the rear edge
    expect(board.z).toBeLessThan(2.5);
    expect(size("gpu").z).toBeCloseTo(3.2, 0); // 320 mm card
    expect(size("cooler").x).toBeGreaterThan(1.5); // 160 mm tower, off the board
    const frame = size("case_frame");
    expect(frame.y).toBeGreaterThan(4.4); // a mid-tower
    for (const id of PART_NAMES) expect(size(id).length(), id).toBeGreaterThan(0.05);
  });

  it("puts every part inside the case at rest, clear of the floor", () => {
    const { root } = buildPc();
    const frame = box(root.getObjectByName("case_frame")!).expandByScalar(0.2);
    for (const id of PART_NAMES) {
      const b = box(root.getObjectByName(id)!);
      expect(frame.containsBox(b), id).toBe(true);
      expect(b.min.y, id).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it("has one slot per part except the frame, each equal to that part's rest pose", () => {
    const { root } = buildPc();
    const ids = PART_NAMES.filter((id) => id !== "case_frame");
    expect(Object.keys(slots).sort()).toEqual(ids.map((id) => `slot_${id}`).sort());
    for (const id of ids) {
      const slot = slots[`slot_${id}`];
      const part = root.getObjectByName(id)!;
      expect(slot.partId).toBe(id);
      expect(slot.position).toEqual(part.position.toArray());
      expect(slot.quaternion).toEqual(part.quaternion.toArray());
      expect(slot.snapRadius).toBeGreaterThan(0);
    }
  });

  it("returns a fresh scene on every call", () => {
    const a = buildPc();
    const b = buildPc();
    expect(a.root).not.toBe(b.root);
    expect(a.root.getObjectByName("cpu")).not.toBe(b.root.getObjectByName("cpu"));
  });
});

/** Every mesh in one part, world matrices current. */
function meshesOf(root: THREE.Object3D, part: string) {
  root.updateMatrixWorld(true);
  const out: THREE.Mesh[] = [];
  root.getObjectByName(part)!.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}
const hex = (m: THREE.Mesh) => (m.material as THREE.MeshStandardMaterial).color.getHexString();
const trisOf = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
const boxOf = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m);
const ray = (targets: THREE.Object3D[], from: [number, number, number], dir: [number, number, number]) =>
  new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize()).intersectObjects(targets, false)[0];

/** Each part's box before the detail pass (the flat boxes), min then max. Detail must stay inside it. */
const BASELINE: Record<string, number[]> = {
  case_frame: [-1.1, 0, -2.3, 1.1, 4.86, 2.3],
  panel_left: [-1.17, 0.22, -2.26, -1.1075, 4.78, 2.26],
  panel_right: [1.11, 0.2, -2.25, 1.146, 4.8, 2.25],
  panel_front: [-1.1, 0.15, 2.33, 1.1, 4.85, 2.41],
  motherboard: [0.542, 1.5, -2.1, 0.858, 4.55, 0.39],
  cpu: [0.795, 3.425, -1.175, 0.842, 3.875, -0.725],
  cooler: [-0.74, 3.015, -1.21, 0.795, 4.285, -0.4127],
  ram_1: [0.39, 2.92, -0.346, 0.83, 4.28, -0.294],
  ram_2: [0.39, 2.92, -0.246, 0.83, 4.28, -0.194],
  ram_3: [0.39, 2.92, -0.146, 0.83, 4.28, -0.094],
  ram_4: [0.39, 2.92, -0.046, 0.83, 4.28, 0.006],
  gpu: [-0.48, 2.1, -2.21, 0.85, 2.9, 1.13],
  psu: [-0.756, 0.25, -2.21, 0.75, 1.11, -0.575],
  nvme: [0.766, 1.9, -1.43, 0.834, 2.14, -0.6],
  ssd_sata: [0.975, 1.65, 0.25, 1.049, 2.35, 1.3],
  fan_front: [-0.65, 2.8, 1.9577, 0.55, 4, 2.2486],
  fan_rear: [-0.7, 3.15, -2.2586, 0.5, 4.35, -1.9677],
  cables: [-0.4057, 0.85, -2.0259, 0.9582, 4.5458, 1.481],
};

describe("detail keeps every part's size, position and budget", () => {
  it("leaves each part's bounding box where the flat boxes had it", () => {
    const { root } = buildPc();
    for (const id of PART_NAMES) {
      const b = box(root.getObjectByName(id)!);
      // The old leads were 48 segments long and missed the true peak of the 8-pin's arc by 2 cm.
      const tol = id === "cables" ? 0.03 : 0.002;
      [...b.min.toArray(), ...b.max.toArray()].forEach((v, i) => expect(Math.abs(v - BASELINE[id][i]), `${id} [${i}]`).toBeLessThan(tol));
    }
  });

  it("stays under 250k triangles, well above the flat boxes, and builds in under 150 ms", () => {
    let tris = 0;
    buildPc().root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) tris += trisOf((o as THREE.Mesh).geometry);
    });
    expect(tris).toBeLessThan(250_000);
    expect(tris).toBeGreaterThan(100_000); // the box model was 26,000
    const times = Array.from({ length: 5 }, () => {
      const t = performance.now();
      buildPc();
      return performance.now() - t;
    });
    expect(Math.min(...times)).toBeLessThan(150);
  });

  it("rounds every edge worth rounding: only tiny contacts and surface-mount parts keep sharp faces", () => {
    const { root } = buildPc();
    const sharp: string[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const id of PART_NAMES)
      for (const m of meshesOf(root, id)) {
        const n = m.geometry.getAttribute("normal");
        let soft = false;
        for (let i = 0; i < n.count && !soft; i++) soft = Math.max(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))) < 0.98;
        if (soft) continue;
        // A sharp mesh may only be made of faces smaller than 5 mm by 10 mm.
        const p = m.geometry.getAttribute("position");
        const idx = m.geometry.index;
        for (let t = 0; t < (idx ? idx.count : p.count) / 3; t++) {
          const at = (k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
          a.fromBufferAttribute(p, at(0));
          b.fromBufferAttribute(p, at(1));
          c.fromBufferAttribute(p, at(2));
          if (b.sub(a).cross(c.sub(a)).length() / 2 > 5e-4) {
            sharp.push(`${id} #${m.id}`);
            break;
          }
        }
      }
    expect(sharp).toEqual([]);
  });
});

describe("glass side panel", () => {
  it("is a rounded pane 2 mm thick with its edge showing, see-through and unclickable, on four standoff screws", () => {
    const { root } = buildPc();
    const meshes = meshesOf(root, "panel_left");
    const pane = meshes.filter((m) => (m.material as THREE.Material).transparent);
    expect(pane).toHaveLength(1);
    const size = boxOf(pane[0]).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(0.02, 4);
    expect(size.y).toBeCloseTo(4.56, 3);
    const n = pane[0].geometry.getAttribute("normal");
    let rounded = false;
    for (let i = 0; i < n.count; i++) rounded ||= Math.abs(n.getX(i)) > 0.2 && Math.abs(n.getX(i)) < 0.98;
    expect(rounded).toBe(true);
    expect((pane[0].material as THREE.MeshStandardMaterial).opacity).toBeLessThan(0.3);
    expect(ray([pane[0]], [-3, 2.5, 0], [1, 0, 0])).toBeUndefined();

    // Screw heads stand outside the glass: cluster their vertices into corners.
    const chrome = meshes.find((m) => hex(m) === "c9ced4")!;
    const p = chrome.geometry.getAttribute("position");
    const corners = new Set<string>();
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(chrome.matrixWorld);
      if (v.x < -1.14) corners.add(`${Math.round(v.y / 2)},${Math.round(v.z / 2)}`);
    }
    expect(corners.size).toBe(4);
  });
});

describe("front intake", () => {
  it("is open louvres: light passes between them, and the front fan is visible behind", () => {
    const { root } = buildPc();
    const front = meshesOf(root, "panel_front");
    const fan = meshesOf(root, "fan_front");
    const firstHit = (y: number) => {
      const hit = ray([...front, ...fan], [0.3, y, 3], [0, 0, -1]);
      return hit ? (front.includes(hit.object as THREE.Mesh) ? "panel" : "fan") : "none";
    };
    const seen = new Set<string>();
    for (let y = 0.4; y < 4.5; y += 0.01) seen.add(firstHit(y));
    expect(seen.has("panel")).toBe(true); // a louvre
    expect(seen.has("fan")).toBe(true); // a gap with the fan behind it
  });
});

describe("fans", () => {
  it("have 9 swept blades (or the 7 asked for) and a frame with rounded corners and mounting holes", () => {
    for (const blades of [undefined, 7]) {
      const fan = buildFan({ size: 1.2, blades });
      const bladeMesh = fan.children
        .flatMap((c) => c.children)
        .filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
        .reduce((a, b) => (a.geometry.getAttribute("position").count > b.geometry.getAttribute("position").count ? a : b));
      expect(bladeMesh.geometry.getAttribute("position").count / 100).toBe(blades ?? 9);
    }
    const fan = buildFan({ size: 1.2 });
    const frame = fan.children[0] as THREE.Mesh;
    const size = boxOf(frame).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.2, 3);
    expect(size.z).toBeCloseTo(1.2, 3);
    // Looking down the airflow: a corner mounting hole passes light, the solid frame beside it does not.
    const hole = 0.6 * 0.835;
    fan.updateMatrixWorld(true);
    expect(ray([frame], [hole, 2, hole], [0, -1, 0])).toBeUndefined();
    expect(ray([frame], [hole + 0.07, 2, hole], [0, -1, 0])).toBeDefined();
    expect(fan.children[1].userData.spin).toBeGreaterThan(0);
  });
});

describe("CPU cooler", () => {
  it("is 40 thin fins on two U-shaped heat pipes that bend at the far end", () => {
    const { root } = buildPc();
    const meshes = meshesOf(root, "cooler");
    const fins = meshes.find((m) => hex(m) === "c3cacf")!;
    const p = fins.geometry.getAttribute("position");
    const planes = new Set<number>();
    for (let i = 0; i < p.count; i++) planes.add(Math.round(p.getX(i) * 1e4));
    expect(planes.size).toBe(80); // a front and a back face for each plate
    const pipes = meshes.filter((m) => m.geometry.type === "TubeGeometry");
    expect(pipes).toHaveLength(2);
    for (const pipe of pipes) {
      const path = (pipe.geometry as THREE.TubeGeometry).parameters.path;
      const pts = path.getPoints(200);
      expect(new THREE.Box3().setFromPoints(pts).getSize(new THREE.Vector3()).x).toBeGreaterThan(1.3);
      expect(path.getLength()).toBeGreaterThan(2.6); // out, round the bend and back
      const xs = pts.map((q) => q.x);
      expect(Math.min(...xs)).toBeLessThan(-0.6); // the bend, at the far end
      expect(xs[0]).toBeGreaterThan(0.7);
      expect(xs[xs.length - 1]).toBeGreaterThan(0.7);
    }
  });
});

describe("motherboard", () => {
  it("has four DIMM slots with a gap, two reinforced x16 slots, twelve VRM fins and eighteen capacitors", () => {
    const { root } = buildPc();
    const board = meshesOf(root, "motherboard");
    const hitX = (from: [number, number, number]) => ray(board, from, [1, 0, 0])?.point.x ?? -Infinity;
    // Into the slot gap the ray reaches the contact strip; a hair to the side it stops on the wall.
    for (const z of RAM_Z) expect(hitX([0.6, 3.6, z]) - hitX([0.6, 3.6, z + 0.017])).toBeGreaterThan(0.03);
    for (const y of [2.735, 1.735]) expect(hitX([0.6, y, -1.15]) - hitX([0.6, y + 0.03, -1.15])).toBeGreaterThan(0.03);

    // Scanning the top VRM block along z, above the side block and between its rails, crosses one run per fin.
    let runs = 0;
    let inFin = false;
    for (let z = -1.62; z < -0.58; z += 0.004) {
      const now = hitX([0.5, 4.34, z]) < 0.7;
      if (now && !inFin) runs++;
      inFin = now;
    }
    expect(runs).toBe(12);

    const cans = board.find((m) => hex(m) === "1b1f24")!;
    expect(trisOf(cans.geometry)).toBe(18 * trisOf(cyl(0.03, 0.07, 0.004, 16)));
  });
});

describe("GPU", () => {
  it("has a round opening under each fan, a slotted backplate and a bracket with port openings", () => {
    const { root } = buildPc();
    const card = meshesOf(root, "gpu");
    const shroud = card.find((m) => hex(m) === "353a42")!;
    for (const z of [-1.45, -0.5, 0.45]) expect(ray([shroud], [0.125, 1.5, z], [0, 1, 0])).toBeUndefined();
    expect(ray([shroud], [0.125, 1.5, -0.975], [0, 1, 0])).toBeDefined(); // the web between two openings

    const back = card.find((m) => hex(m) === "434952" && boxOf(m).getSize(new THREE.Vector3()).z > 3)!;
    expect(ray([back], [0, 3.5, -1.0], [0, -1, 0])).toBeUndefined(); // a vent slot
    expect(ray([back], [0, 3.5, -0.95], [0, -1, 0])).toBeDefined(); // solid between slots

    const bracket = card.find((m) => hex(m) === "c9ced4" && boxOf(m).getSize(new THREE.Vector3()).z < 0.03)!;
    expect(ray([bracket], [0.56, 2.5, -3], [0, 0, 1])).toBeUndefined(); // a port
    expect(ray([bracket], [0.56, 2.7, -3], [0, 0, 1])).toBeDefined();
  });
});

describe("PSU", () => {
  it("has a fan opening with a grille and a vent row on its underside, and a socketed connector panel", () => {
    const { root } = buildPc();
    const meshes = meshesOf(root, "psu");
    const under = meshes.filter((m) => boxOf(m).max.y < 0.27);
    expect(under.length).toBeGreaterThanOrEqual(2); // the plate and the grille
    // Up through the opening the ray reaches the enclosure above the plate, not the plate.
    expect(ray(meshes, [0.2, 0, -1.45], [0, 1, 0]).point.y).toBeGreaterThan(0.255);
    expect(ray(meshes, [0.7, 0, -0.7], [0, 1, 0]).point.y).toBeLessThan(0.255);
    const b = boxOf(meshes.find((m) => m.userData.finish === "plastic")!);
    expect(b.min.z).toBeCloseTo(-0.595, 3);
    expect(b.max.z).toBeCloseTo(-0.575, 3);
  });
});

describe("cables", () => {
  it("are sleeved tubes with a plug at each end that the game draws in from the supply outward", () => {
    const { root } = buildPc();
    const meshes = meshesOf(root, "cables");
    const tubes = meshes.filter((m) => m.geometry.type === "TubeGeometry");
    const plugs = meshes.filter((m) => m.geometry.type !== "TubeGeometry");
    expect(tubes).toHaveLength(4);
    expect(plugs).toHaveLength(4);
    for (const m of meshes) expect(m.userData.cable).toBe(true);
    tubes.forEach((tube, i) => {
      const path = (tube.geometry as THREE.TubeGeometry).parameters.path;
      const plug = plugs[i];
      expect(plug.userData.finish).toBe("plastic");
      // The start plug's triangles come first, the far plug's last, so a partial draw grows outward.
      const idx = plug.geometry.index!;
      expect(idx.count % 6).toBe(0);
      const half = idx.count / 2;
      const p = plug.geometry.getAttribute("position");
      const centre = (from: number, to: number) => {
        const b = new THREE.Box3();
        for (let k = from; k < to; k++) b.expandByPoint(new THREE.Vector3().fromBufferAttribute(p, idx.getX(k)).applyMatrix4(plug.matrixWorld));
        return b.getCenter(new THREE.Vector3());
      };
      const start = path.getPointAt(0).applyMatrix4(tube.matrixWorld);
      const end = path.getPointAt(1).applyMatrix4(tube.matrixWorld);
      expect(centre(0, half).distanceTo(start), `lead ${i} start`).toBeLessThan(0.4);
      expect(centre(half, idx.count).distanceTo(end), `lead ${i} end`).toBeLessThan(0.4);
    });
  });
});
