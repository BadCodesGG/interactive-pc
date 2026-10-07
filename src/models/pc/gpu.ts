/**
 * The graphics card: a moulded shroud with a round cut-out under each of three fans, a heatsink of
 * thin fins and heat pipes behind the cut-outs, a backplate with vents, the PCIe bracket with its
 * port openings and vents, and the power socket. The card lies flat, fans facing down.
 */
import * as T from "three";
import { circlePath, flatSlab, rbox, rrPath, rrShape, slab } from "./geo";
import { Kit, PAL, RGB } from "./kit";
import { fanAt, glowMesh } from "./parts";

const FAN_Z = [-1.45, -0.5, 0.45];

export function gpu(g: T.Group) {
  const k = new Kit(g);
  k.box([1.15, 0.016, 3.1], [0.125, 2.735, -0.5], k.surface(PAL.pcb), 0.004, 1);
  k.box([0.15, 0.014, 0.395], [0.775, 2.735, -1.3975], k.surface(PAL.gold), 0.002, 1); // contacts, with the key between
  k.box([0.15, 0.014, 0.455], [0.775, 2.735, -0.9325], k.surface(PAL.gold), 0.002, 1);

  // Shroud: authored flat with v = -z, 0.46 thick, a round opening under each fan.
  const shape = rrShape(-0.435, -1.09, 0.685, 2.05, 0.06);
  for (const z of FAN_Z) shape.holes.push(circlePath(0.125, -z, 0.43));
  k.solo(flatSlab(shape, 0.46, 0.01, 24), k.mat("#353a42", 0.35, 0.42, { holed: true }), [0, 2.24, 0], true);

  // Backplate over the PCB, slotted over the fan area.
  const back = rrShape(-0.45, -1.06, 0.7, 2.06, 0.03);
  for (let i = 0; i < 9; i++) back.holes.push(rrPath(-0.3, 0.8 + i * 0.1 - 0.02, 0.55, 0.8 + i * 0.1 + 0.02, 0.015));
  k.solo(flatSlab(back, 0.02, 0.006, 12), k.mat("#434952", 0.4, 0.38, { holed: true }), [0, 2.745, 0], true);
  // Trim along the shroud's glass-side wall.
  const trim = k.mat("#434952", 0.4, 0.38);
  for (const y of [2.3, 2.64]) k.box([0.008, 0.03, 2.7], [-0.439, y, -0.45], trim, 0.003, 1);
  k.flush();

  // Heatsink behind the cut-outs: 36 fins and five copper pipes through them.
  const sink = new Kit(g);
  const aluminium = sink.surface(PAL.alu);
  for (let i = 0; i < 36; i++) sink.box([1.04, 0.26, 0.012], [0.125, 2.57, -1.9 + i * 0.08], aluminium, 0.004, 1);
  const copper = sink.surface(PAL.copper);
  for (const x of [-0.3, -0.1, 0.1, 0.3, 0.5]) sink.rod(0.022, 2.9, [x, 2.52, -0.5], "z", copper, 0, 12);
  sink.flush();

  for (const z of FAN_Z) fanAt(g, [0.12, 2.26, z], 0.92, "-y", undefined, false);
  const edge = glowMesh(rbox(0.012, 0.06, 2.7, 0.005, 1).clone(), RGB.magenta, 2.2);
  edge.position.set(-0.442, 2.55, -0.45);
  g.add(edge);

  // PCIe bracket: a plate with four port openings and a row of vent slots, and dark port housings behind.
  const br = new Kit(g);
  const plate = rrShape(-0.48, 2.1, 0.72, 2.9, 0.02);
  for (const [x, w] of [[0.56, 0.15], [0.36, 0.15], [0.16, 0.15], [-0.04, 0.17]] as const) plate.holes.push(rrPath(x - w / 2, 2.455, x + w / 2, 2.545, 0.012));
  for (let i = 0; i < 7; i++) plate.holes.push(rrPath(-0.428 + i * 0.035, 2.25, -0.412 + i * 0.035, 2.75, 0.006));
  br.solo(slab(plate, 0.02, 0.005, 12), br.surface(PAL.silver, { holed: true }), [0, 0, -2.21], true);
  const housing = br.surface(PAL.black);
  for (const [x, w] of [[0.56, 0.15], [0.36, 0.15], [0.16, 0.15], [-0.04, 0.17]] as const) br.box([w + 0.02, 0.11, 0.06], [x, 2.5, -2.16], housing, 0.008, 1);
  br.flush();

  // Power socket on the end of the card.
  const pw = new Kit(g);
  const socket = pw.surface(PAL.black);
  pw.box([0.2, 0.14, 0.04], [0.0, 2.45, 1.11], socket, 0.008, 2);
  pw.box([0.07, 0.02, 0.02], [0.0, 2.53, 1.11], socket, 0.005, 1);
  pw.flush();
}
