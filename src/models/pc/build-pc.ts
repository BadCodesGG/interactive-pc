/**
 * A gaming PC built in code: 18 named parts, each a direct child of the root, in the assembled
 * pose. That rest pose is also where every part goes in the build game, so `slots` is derived from
 * the same numbers. The parts' geometry lives beside this file (chassis, board, cooler, gpu, psu,
 * cables); this file names them, places them and builds the scene.
 *
 * Fans come from pc-anatomy by Yoosseph (https://github.com/Yoosseph/pc-anatomy),
 * Copyright (c) 2026 Yoseph, MIT License (see ./parts.ts and LICENSE-pc-anatomy.txt). The rest is
 * built from primitives in the same visual language: a dark case, brushed steel panels, a black
 * and green board, gold contacts, and RGB on the fans, memory and card. No brand text anywhere.
 *
 * Units: 1 = 100 mm. Axes: +y up, the case front faces +z, the glass (left) panel is at -x and the
 * motherboard hangs on the tray at +x with its components facing -x, as in a real mid-tower.
 * No DOM: `npm run check:sidecar` builds this in Node.
 */
import * as T from "three";
import { cables } from "./cables";
import { cpu, motherboard, nvme, ram, ssdSata } from "./board";
import { caseFrame, panelFront, panelLeft, panelRight } from "./chassis";
import { cooler } from "./cooler";
import { gpu } from "./gpu";
import { RAM_Z, RGB } from "./kit";
import { fanAt } from "./parts";
import { psu } from "./psu";

export const PART_NAMES = [
  "case_frame",
  "panel_left",
  "panel_right",
  "panel_front",
  "motherboard",
  "cpu",
  "cooler",
  "ram_1",
  "ram_2",
  "ram_3",
  "ram_4",
  "gpu",
  "psu",
  "nvme",
  "ssd_sata",
  "fan_front",
  "fan_rear",
  "cables",
] as const;

export type PartName = (typeof PART_NAMES)[number];
type V3 = [number, number, number];

export interface Slot {
  position: V3;
  quaternion: [number, number, number, number];
  partId: PartName;
  /** How close (model units) a dragged part must be released to snap in. */
  snapRadius: number;
}

/** Each part's origin in the assembled machine. Geometry is authored in world space around it. */
const REST: Record<PartName, V3> = {
  case_frame: [0, 2.45, 0],
  panel_left: [-1.12, 2.5, 0],
  panel_right: [1.125, 2.5, 0],
  panel_front: [0, 2.5, 2.37],
  motherboard: [0.85, 3.025, -0.83],
  cpu: [0.815, 3.65, -0.95],
  cooler: [-0.05, 3.65, -0.85],
  ram_1: [0.61, 3.6, RAM_Z[0]],
  ram_2: [0.61, 3.6, RAM_Z[1]],
  ram_3: [0.61, 3.6, RAM_Z[2]],
  ram_4: [0.61, 3.6, RAM_Z[3]],
  gpu: [0.12, 2.47, -0.5],
  psu: [0, 0.68, -1.4],
  nvme: [0.81, 2.02, -1.0],
  ssd_sata: [1.01, 2.0, 0.8],
  fan_front: [-0.05, 3.4, 2.117],
  fan_rear: [-0.1, 3.75, -2.127],
  cables: [0.3, 2.3, 0.2],
};

const SNAP: Record<Exclude<PartName, "case_frame">, number> = {
  panel_left: 0.8,
  panel_right: 0.8,
  panel_front: 0.8,
  motherboard: 0.8,
  cpu: 0.3,
  cooler: 0.6,
  ram_1: 0.22,
  ram_2: 0.22,
  ram_3: 0.22,
  ram_4: 0.22,
  gpu: 0.7,
  psu: 0.7,
  nvme: 0.3,
  ssd_sata: 0.4,
  fan_front: 0.6,
  fan_rear: 0.6,
  cables: 0.8,
};

/** Slot id to target pose: every part except the frame, equal to its rest pose. */
export const slots: Record<string, Slot> = Object.fromEntries(
  (Object.keys(SNAP) as (keyof typeof SNAP)[]).map((id) => [
    `slot_${id}`,
    { position: [...REST[id]] as V3, quaternion: [0, 0, 0, 1], partId: id, snapRadius: SNAP[id] },
  ]),
);

const builders: Record<PartName, (g: T.Group) => void> = {
  case_frame: caseFrame,
  panel_left: panelLeft,
  panel_right: panelRight,
  panel_front: panelFront,
  motherboard,
  cpu,
  cooler,
  ram_1: (g) => ram(g, 0),
  ram_2: (g) => ram(g, 1),
  ram_3: (g) => ram(g, 2),
  ram_4: (g) => ram(g, 3),
  gpu,
  psu,
  nvme,
  ssd_sata: ssdSata,
  fan_front: (g) => void fanAt(g, REST.fan_front, 1.2, "-z", RGB.cyan),
  fan_rear: (g) => void fanAt(g, REST.fan_rear, 1.2, "+z", RGB.violet),
  cables,
};

/** Builds the machine. Every call returns a new scene the caller owns. */
export function buildPc(): { root: T.Group; partNames: string[] } {
  const root = new T.Group();
  root.name = "pc";
  for (const id of PART_NAMES) {
    const g = new T.Group();
    g.name = id;
    builders[id](g);
    // Authored in world space; move the origin to the part's rest point.
    const [rx, ry, rz] = REST[id];
    for (const c of g.children) c.position.sub(new T.Vector3(rx, ry, rz));
    g.position.set(rx, ry, rz);
    root.add(g);
  }
  root.traverse((o) => {
    if ((o as T.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  return { root, partNames: [...PART_NAMES] };
}
