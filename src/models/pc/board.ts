/**
 * The motherboard and what plugs into it directly: CPU, memory, M.2 drive and the 2.5 inch drive.
 * The board faces -x (components on its -x side, PCB at x = 0.85), as in a real tower.
 */
import * as T from "three";
import { polyShape, rbox, slab } from "./geo";
import { Kit, PAL, RAM_Z, RGB, rng } from "./kit";
import { glowMesh } from "./parts";

/** Board component face. */
const X = 0.842;

/** The rectangles (y0, y1, z0, z1) the fixed parts occupy, for scattering small detail around them. */
const OCCUPIED: [number, number, number, number][] = [
  [3.32, 3.98, -1.29, -0.61], // CPU socket
  [4.08, 4.42, -1.65, -0.55], // VRM, top
  [3.08, 4.32, -1.77, -1.43], // VRM, side
  [3.23, 4.37, -2.06, -1.74], // I/O shroud and ports
  [2.83, 4.37, -0.37, 0.05], // DIMM slots
  [2.68, 2.79, -1.62, -0.68], // PCIe x16, upper
  [1.68, 1.79, -1.62, -0.68], // PCIe x16, lower
  [1.88, 2.16, -1.48, -0.53], // M.2
  [1.63, 2.27, -0.32, 0.32], // chipset
  [1.63, 1.97, -0.74, -0.46], // battery
  [2.95, 3.55, 0.26, 0.4], // 24-pin
  [4.37, 4.53, -1.98, -1.72], // 8-pin
  [3.04, 3.16, -1.42, -0.62], // capacitors, row A
  [1.54, 1.66, -1.87, -0.72], // capacitors, row B
  [4.41, 4.53, -1.72, -0.58], // chokes
];
const SCREWS: [number, number][] = [
  [1.6, -1.95],
  [1.6, 0.3],
  [4.45, 0.3],
  [4.45, -1.3],
  [2.9, -1.95],
  [2.9, 0.3],
];

/** A heatsink block on the board: a base plate, fins across it, and two rails along its outer edge. */
function finBlock(k: Kit, sink: T.Material, xOuter: number, y: [number, number], z: [number, number], along: "y" | "z", n: number) {
  const base = 0.05;
  const rail = 0.02;
  const yc = (y[0] + y[1]) / 2;
  const zc = (z[0] + z[1]) / 2;
  const ly = y[1] - y[0];
  const lz = z[1] - z[0];
  k.box([base, ly, lz], [X - base / 2, yc, zc], sink, 0.01, 1);
  const depth = X - base - xOuter;
  const len = along === "z" ? lz : ly;
  const pitch = (len - 0.02) / (n - 1);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + 0.01 + i * pitch;
    if (along === "z") k.box([depth, ly, 0.02], [xOuter + depth / 2, yc, zc + t], sink, 0.005, 1);
    else k.box([depth, 0.02, lz], [xOuter + depth / 2, yc + t, zc], sink, 0.005, 1);
  }
  // Rails cap the fins at the two ends, leaving the middle band of fins visible.
  const off = (along === "z" ? ly : lz) / 2 - 0.015;
  for (const s of [-1, 1]) {
    if (along === "z") k.box([rail, 0.03, lz], [xOuter + rail / 2, yc + s * off, zc], sink, 0.008, 1);
    else k.box([rail, ly, 0.03], [xOuter + rail / 2, yc, zc + s * off], sink, 0.008, 1);
  }
}

export function motherboard(g: T.Group) {
  const pcbKit = new Kit(g);
  pcbKit.solo(rbox(0.016, 3.05, 2.44, 0.004, 1), pcbKit.surface(PAL.pcb), [0.85, 3.025, -0.83]);

  // CPU socket: the silver load frame around the chip and its lever.
  const sock = new Kit(g);
  const silver = sock.surface(PAL.silver);
  for (const [dy, dz, sy, sz] of [
    [0.29, 0, 0.04, 0.62],
    [-0.29, 0, 0.04, 0.62],
    [0, 0.29, 0.62, 0.04],
    [0, -0.29, 0.62, 0.04],
  ] as const)
    sock.box([0.03, sy, sz], [X - 0.015, 3.65 + dy, -0.95 + dz], silver, 0.008, 1);
  sock.rod(0.012, 0.5, [X - 0.02, 3.65, -0.6], "y", silver, 0.004, 10);
  sock.rod(0.022, 0.014, [X - 0.02, 3.4, -0.6], "x", silver, 0.004, 12);
  sock.flush();

  // VRM heatsinks above and beside the socket.
  const vrm = new Kit(g);
  finBlock(vrm, vrm.surface(PAL.sink), 0.642, [4.1, 4.4], [-1.625, -0.575], "z", 12);
  vrm.flush();
  const vrm2 = new Kit(g);
  finBlock(vrm2, vrm2.surface(PAL.sink), 0.642, [3.1, 4.3], [-1.75, -1.45], "y", 12);
  vrm2.flush();

  // Chokes along the top VRM, and the two power sockets with their pins.
  const power = new Kit(g);
  const choke = power.mat("#22262b", 0.1, 0.6);
  for (let i = 0; i < 10; i++) power.box([0.05, 0.07, 0.07], [X - 0.025, 4.47, -1.65 + i * 0.11], choke, 0.008, 1);
  const socketBlack = power.surface(PAL.black);
  const pin = power.surface(PAL.gold);
  power.box([0.1, 0.55, 0.08], [X - 0.05, 3.25, 0.33], socketBlack, 0.008, 1);
  power.box([0.1, 0.1, 0.2], [X - 0.05, 4.45, -1.85], socketBlack, 0.008, 1);
  for (let i = 0; i < 12; i++) for (const dz of [-0.017, 0.017]) power.box([0.008, 0.02, 0.014], [X - 0.1, 3.0 + i * 0.0455, 0.33 + dz], pin, 0, 1);
  for (let i = 0; i < 4; i++) for (const dy of [-0.025, 0.025]) power.box([0.008, 0.02, 0.026], [X - 0.1, 4.45 + dy, -1.885 + i * 0.04], pin, 0, 1);
  power.flush();

  // The rear I/O shroud, and the port cluster below it in its own metal cage.
  const io = new Kit(g);
  const shroud = io.mat("#3a4048", 0.4, 0.4);
  io.box([0.294, 1.1, 0.28], [0.695, 3.8, -1.9], shroud, 0.02, 2);
  const accent = io.surface(PAL.sink);
  io.box([0.008, 0.9, 0.18], [0.546, 3.8, -1.9], accent, 0.003, 1);
  for (let i = 0; i < 6; i++) io.box([0.008, 0.06, 0.2], [0.546, 3.5 + i * 0.12, -1.9], io.surface(PAL.black), 0.003, 1);
  io.flush();

  const ports = new Kit(g);
  const cage = ports.mat("#a9afb6", 0.4, 0.4);
  const dark = ports.surface(PAL.black);
  ports.box([0.28, 1.05, 0.14], [0.69, 3.8, -2.02], cage, 0.012, 2);
  for (const x of [0.62, 0.76]) ports.box([0.13, 0.14, 0.015], [x, 3.45, -2.0925], dark, 0.004, 1); // RJ45
  for (const x of [0.62, 0.76]) for (let i = 0; i < 6; i++) ports.box([0.12, 0.055, 0.015], [x, 3.8 + i * 0.075, -2.0925], dark, 0.004, 1); // USB
  for (const x of [0.6, 0.69, 0.78]) ports.rod(0.026, 0.015, [x, 3.66, -2.0925], "z", dark, 0.004, 14); // audio
  ports.flush();

  // DIMM slots: two walls with the gap the module's edge sits in, a contact strip at its bottom, latches.
  const dimm = new Kit(g);
  const slotBody = dimm.mat("#23262b", 0.1, 0.7);
  const latch = dimm.mat("#4a4f56", 0.2, 0.6);
  const strip = dimm.surface(PAL.gold);
  for (const z of RAM_Z) {
    for (const s of [-1, 1]) dimm.box([0.06, 1.45, 0.018], [X - 0.03, 3.6, z + s * 0.016], slotBody, 0.004, 1);
    dimm.box([0.012, 1.36, 0.012], [X - 0.006, 3.6, z], strip, 0.002, 1);
    for (const y of [2.85, 4.35]) {
      dimm.box([0.07, 0.05, 0.06], [X - 0.035, y, z], latch, 0.01, 1);
      dimm.box([0.03, 0.02, 0.05], [X - 0.075, y + (y > 3.6 ? 0.03 : -0.03), z], latch, 0.005, 1);
    }
  }
  dimm.flush();

  // Two x16 slots: a slot between two walls, steel reinforcement over the outside and across the ends.
  const pcie = new Kit(g);
  const body = pcie.surface(PAL.black);
  const steel = pcie.surface(PAL.silver);
  const gold = pcie.surface(PAL.gold);
  for (const y of [2.735, 1.735]) {
    for (const s of [-1, 1]) {
      pcie.box([0.07, 0.02, 0.9], [X - 0.035, y + s * 0.02, -1.15], body, 0.005, 1);
      pcie.box([0.072, 0.006, 0.9], [X - 0.036, y + s * 0.033, -1.15], steel, 0.002, 1);
    }
    pcie.box([0.012, 0.02, 0.86], [X - 0.006, y, -1.15], gold, 0.002, 1);
    for (const z of [-1.6, -0.7]) pcie.box([0.072, 0.072, 0.012], [X - 0.036, y, z], steel, 0.003, 1);
    pcie.box([0.05, 0.05, 0.03], [X - 0.045, y, -0.66], body, 0.008, 1); // release latch
  }
  pcie.flush();

  // M.2 socket with its standoff and screw, chipset heatsink, coin cell.
  const misc = new Kit(g);
  misc.box([0.03, 0.24, 0.06], [X - 0.015, 2.02, -1.43], misc.surface(PAL.black), 0.006, 1);
  misc.rod(0.022, 0.03, [X - 0.015, 2.02, -0.58], "x", misc.surface(PAL.gold), 0.004, 12);
  misc.rod(0.016, 0.008, [X - 0.032, 2.02, -0.58], "x", misc.surface(PAL.silver), 0.002, 6);
  const sink = misc.surface(PAL.sink);
  misc.box([0.05, 0.6, 0.6], [X - 0.025, 1.95, 0], sink, 0.01, 1);
  for (let i = 0; i < 6; i++) misc.box([0.07, 0.04, 0.56], [X - 0.085, 1.7 + i * 0.1, 0], sink, 0.008, 1);
  misc.rod(0.115, 0.024, [X - 0.012, 1.8, -0.6], "x", misc.surface(PAL.black), 0.008, 28);
  misc.rod(0.1, 0.03, [X - 0.015, 1.8, -0.6], "x", misc.surface(PAL.silver), 0.008, 28);
  misc.box([0.012, 0.03, 0.09], [X - 0.036, 1.9, -0.6], misc.surface(PAL.silver), 0.004, 1);
  misc.flush();

  // Standoff screws: hex heads.
  const screws = new Kit(g);
  for (const [y, z] of SCREWS) screws.rod(0.03, 0.01, [X - 0.005, y, z], "x", screws.surface(PAL.silver), 0.002, 6);
  screws.flush();

  // Capacitors and chokes scattered over the board's fixed rows: sparse, so their box is not a clearance obstacle.
  const caps = new Kit(g);
  const can = caps.mat("#1b1f24", 0.1, 0.5, { holed: true });
  const lid = caps.mat("#9aa1a8", 0.4, 0.4, { holed: true });
  const capAt = (y: number, z: number) => {
    caps.rod(0.03, 0.07, [X - 0.035, y, z], "x", can, 0.004, 16);
    caps.rod(0.021, 0.003, [X - 0.0705, y, z], "x", lid, 0.001, 16);
  };
  for (let i = 0; i < 7; i++) capAt(3.1, -1.35 + i * 0.11);
  for (let i = 0; i < 11; i++) capAt(1.6, -1.8 + i * 0.1);
  caps.flush();

  // Small surface-mount parts, scattered where nothing else stands.
  const smd = new Kit(g);
  const parts = [smd.mat("#25282c", 0.2, 0.6, { holed: true }), smd.mat("#8c7a5c", 0.1, 0.6, { holed: true }), smd.mat("#d6b56a", 0.5, 0.35, { holed: true })];
  const rand = rng(7);
  const free = (y: number, z: number) =>
    !OCCUPIED.some(([y0, y1, z0, z1]) => y > y0 && y < y1 && z > z0 && z < z1) && !SCREWS.some(([sy, sz]) => Math.abs(y - sy) < 0.05 && Math.abs(z - sz) < 0.05);
  for (let placed = 0, tries = 0; placed < 220 && tries < 2000; tries++) {
    const y = 1.55 + rand() * 2.95;
    const z = -2.0 + rand() * 2.34;
    if (!free(y, z)) continue;
    const tall = rand() < 0.5;
    smd.box([0.004, tall ? 0.02 : 0.012, tall ? 0.012 : 0.02], [X - 0.002, y, z], parts[rand() < 0.6 ? 0 : rand() < 0.75 ? 1 : 2], 0, 1);
    placed++;
  }
  smd.flush();
}

const RAM_PROFILE: [number, number][] = [
  [0.48, 2.92],
  [0.785, 2.92],
  [0.8, 2.935],
  [0.8, 4.265],
  [0.785, 4.28],
  [0.48, 4.28],
  [0.44, 4.24],
  [0.44, 2.96],
];
const RAM_RIDGE: [number, number][] = [
  [0.52, 3.06],
  [0.76, 3.06],
  [0.76, 4.14],
  [0.7, 4.2],
  [0.52, 4.2],
];
let ramShapes: { plate: T.BufferGeometry; ridge: T.BufferGeometry } | undefined;

/** One memory module: green PCB, a two-piece heat-spreader with a raised ridge, gold fingers, a lit top bar. */
export function ram(g: T.Group, i: number) {
  const z = RAM_Z[i];
  ramShapes ??= { plate: slab(polyShape(RAM_PROFILE), 0.014, 0.003), ridge: slab(polyShape(RAM_RIDGE), 0.006, 0.0015) };
  const k = new Kit(g);
  k.box([0.32, 1.33, 0.012], [0.64, 3.6, z], k.surface(PAL.pcbGreen), 0.002, 1);
  const spreader = k.mat("#4a515b", 0.4, 0.38);
  for (const s of [-1, 1]) {
    // Front side extrudes +z from its origin; the back side starts one plate thickness lower.
    k.put(ramShapes.plate, spreader, [0, 0, s > 0 ? z + 0.006 : z - 0.02]);
    k.put(ramShapes.ridge, spreader, [0, 0, s > 0 ? z + 0.02 : z - 0.026]);
  }
  const fingers = k.surface(PAL.gold);
  k.box([0.03, 0.52, 0.014], [0.815, 3.26, z], fingers, 0.002, 1);
  k.box([0.03, 0.65, 0.014], [0.815, 3.875, z], fingers, 0.002, 1);
  const cap = k.mat("#1f2227", 0.1, 0.7);
  for (const y of [2.935, 4.265]) k.box([0.05, 0.03, 0.05], [0.415, y, z], cap, 0.008, 1);
  k.flush();
  const bar = glowMesh(rbox(0.05, 1.3, 0.045, 0.012).clone(), i % 2 ? RGB.violet : RGB.magenta, 2.2);
  bar.position.set(0.415, 3.6, z);
  g.add(bar);
}

export function cpu(g: T.Group) {
  const k = new Kit(g);
  k.box([0.014, 0.45, 0.45], [0.832, 3.65, -0.95], k.surface(PAL.pcbGreen), 0.004, 1);
  // The heat spreader: a flat flange with a stepped lid on it.
  const lid = k.mat("#d3d8dd", 0.45, 0.3);
  k.box([0.012, 0.38, 0.38], [0.819, 3.65, -0.95], lid, 0.006, 1);
  k.box([0.02, 0.3, 0.3], [0.805, 3.65, -0.95], lid, 0.01, 2);
  k.box([0.003, 0.42, 0.42], [0.8405, 3.65, -0.95], k.surface(PAL.gold), 0.001, 1); // contact pads on the underside
  k.put(new T.CylinderGeometry(0.03, 0.03, 0.004, 3), k.surface(PAL.gold), [0.823, 3.84, -1.14], "x");
  // Capacitors in the margin around the spreader.
  const smd = k.mat("#8c7a5c", 0.1, 0.6);
  for (let i = 0; i < 5; i++)
    for (const s of [-1, 1]) {
      const t = -0.14 + i * 0.07;
      k.box([0.008, 0.012, 0.02], [0.821, 3.65 + s * 0.208, -0.95 + t], smd, 0, 1);
      k.box([0.008, 0.02, 0.012], [0.821, 3.65 + t, -0.95 + s * 0.208], smd, 0, 1);
    }
  k.flush();
}

export function nvme(g: T.Group) {
  const k = new Kit(g);
  k.box([0.012, 0.22, 0.8], [0.828, 2.02, -1.0], k.surface(PAL.pcb), 0.003, 1);
  const sink = k.mat("#3b4149", 0.4, 0.4);
  k.box([0.03, 0.24, 0.72], [0.807, 2.02, -0.98], sink, 0.008, 2);
  const rib = k.mat("#565e68", 0.4, 0.4);
  for (let i = 0; i < 6; i++) k.box([0.026, 0.24, 0.024], [0.779, 2.02, -1.25 + i * 0.1], rib, 0.006, 1);
  // Edge connector: 18 contacts.
  const gold = k.surface(PAL.gold);
  for (let i = 0; i < 18; i++) k.box([0.012, 0.007, 0.04], [0.828, 2.02 + (i - 8.5) * 0.011, -1.41], gold, 0, 1);
  k.flush();
}

export function ssdSata(g: T.Group) {
  const k = new Kit(g);
  // Two shell halves with a dark core showing in the seam between them.
  const shell = k.mat("#474d56", 0.35, 0.45);
  k.box([0.0325, 0.7, 1.0], [0.99125, 2.0, 0.8], shell, 0.01, 2);
  k.box([0.0325, 0.7, 1.0], [1.02875, 2.0, 0.8], shell, 0.01, 2);
  k.box([0.006, 0.688, 0.988], [1.01, 2.0, 0.8], k.surface(PAL.black), 0.002, 1);
  k.box([0.004, 0.5, 0.7], [1.047, 2.0, 0.82], k.mat("#6a727d", 0.3, 0.5), 0.002, 1);
  const screw = k.surface(PAL.silver);
  for (const y of [1.7, 2.3]) for (const z of [0.36, 1.24]) k.rod(0.028, 0.006, [1.046, y, z], "x", screw, 0.002, 6);
  // SATA plug: a data block and a power block, contacts on the end face.
  const black = k.surface(PAL.black);
  k.box([0.03, 0.15, 0.05], [1.01, 1.87, 0.285], black, 0.005, 1);
  k.box([0.03, 0.22, 0.05], [1.01, 2.09, 0.285], black, 0.005, 1);
  const gold = k.surface(PAL.gold);
  for (let i = 0; i < 7; i++) k.box([0.006, 0.007, 0.014], [1.01, 1.81 + i * 0.02, 0.257], gold, 0, 1);
  for (let i = 0; i < 15; i++) k.box([0.006, 0.007, 0.014], [1.01, 2.005 + i * 0.0125, 0.257], gold, 0, 1);
  k.flush();
}
