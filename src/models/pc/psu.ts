/**
 * The power supply: a rounded enclosure, a modular connector panel with real sockets, a slatted
 * exhaust grille and inlet at the rear, and on its underside a fan grille (rings and spokes in a round
 * opening) and a vent grille. Everything on the underside sits above y = 0.25, so the box is unchanged.
 */
import * as T from "three";
import { circlePath, flatSlab, place, rbox, rectPath, ring, rrPath, rrShape, slab } from "./geo";
import { Kit } from "./kit";

/** A rounded frame `w` by `h` around an opening, `depth` thick. */
function frame(w: number, h: number, depth: number, wall = 0.014) {
  const s = rrShape(-w / 2, -h / 2, w / 2, h / 2, 0.012);
  s.holes.push(rrPath(-w / 2 + wall, -h / 2 + wall, w / 2 - wall, h / 2 - wall, 0.006));
  return slab(s, depth, depth * 0.15, 8);
}

export function psu(g: T.Group) {
  const k = new Kit(g);
  // Enclosure from y = 0.262; the bottom plate below it brings the box down to y = 0.25.
  k.box([1.5, 0.848, 1.6], [0, 0.686, -1.4], k.mat("#2a2e34", 0.2, 0.7), 0.03, 2);
  k.box([0.006, 0.5, 0.9], [-0.753, 0.7, -1.4], k.mat("#4a515a", 0.3, 0.5), 0.002, 1);

  // Connector panel, sockets in three rows.
  k.box([1.3, 0.6, 0.01], [0, 0.68, -0.595], k.mat("#0c0d0f", 0.1, 0.8), 0.003, 1);
  const shell = k.mat("#262a2f", 0.1, 0.6, { finish: "plastic" });
  const rows: [number, number, number, number, number][] = [
    [0.85, 0.16, 0.1, 5, 0.25],
    [0.65, 0.1, 0.08, 6, 0.22],
    [0.47, 0.09, 0.06, 4, 0.3],
  ];
  for (const [y, w, h, n, pitch] of rows) {
    const socket = frame(w, h, 0.02);
    for (let i = 0; i < n; i++) k.put(socket, shell, [(i - (n - 1) / 2) * pitch, y, -0.595]);
  }
  k.flush();

  // Rear: a shallow plate, louvres across half of it and a mains inlet and switch on the rest.
  const rear = new Kit(g);
  rear.box([1.1, 0.6, 0.005], [0, 0.68, -2.2025], rear.mat("#0a0b0c", 0.5, 0.6), 0.002, 1);
  const bars = rear.mat("#1d2025", 0.4, 0.5);
  for (let i = 0; i < 10; i++) rear.box([0.55, 0.028, 0.005], [0.22, 0.43 + i * 0.052, -2.2075], bars, 0.002, 1);
  const inlet = rear.mat("#2a2e34", 0.3, 0.55);
  rear.put(frame(0.3, 0.2, 0.005, 0.04), inlet, [-0.33, 0.78, -2.21]);
  rear.box([0.07, 0.11, 0.005], [-0.33, 0.52, -2.2075], inlet, 0.002, 1);
  rear.flush();

  // Underside: a plate with a round fan opening and a row of vent slots, rings and spokes across the opening.
  const fanZ = -1.55;
  const plate = rrShape(-0.75, 0.6, 0.75, 2.2, 0.03); // v = -z
  plate.holes.push(circlePath(0, -fanZ, 0.58));
  for (let i = 0; i < 6; i++) plate.holes.push(rectPath(-0.65, 0.68 + i * 0.05, 0.65, 0.68 + i * 0.05 + 0.028));
  const bottom = new Kit(g);
  bottom.solo(flatSlab(plate, 0.012, 0.003, 32), bottom.mat("#2a2e34", 0.2, 0.7, { holed: true }), [0, 0.25, 0], true);
  const wire = bottom.mat("#15171a", 0.2, 0.6);
  for (const R of [0.14, 0.28, 0.42, 0.575]) bottom.put(ring(R, 0.009), wire, [0, 0.259, fanZ]);
  for (let i = 0; i < 3; i++) {
    const m = place([0, 0.259, fanZ]).multiply(new T.Matrix4().makeRotationY((i / 3) * Math.PI));
    bottom.putM(rbox(1.17, 0.012, 0.012, 0.004, 1), wire, m);
  }
  bottom.rod(0.08, 0.014, [0, 0.257, fanZ], "y", wire, 0.004, 24);
  bottom.flush();
}
