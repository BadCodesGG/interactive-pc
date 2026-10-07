/**
 * The case: frame, glass panel, steel panel and the front intake. Steel edges are a couple of
 * millimetres round, the intake is a real row of louvres with the front fan visible behind it, and the
 * glass is a pane with a thickness you can see the edge of and four standoff screws.
 */
import * as T from "three";
import { rbox, rectPath, circlePath, rrShape, rrPath, polyShape, slab } from "./geo";
import { Kit, PAL, RGB } from "./kit";
import { glowMesh } from "./parts";

/** A flat plate from an outline, with holes, extruded `depth` along +z from `z`. Its box covers its openings. */
function plate(k: Kit, outline: [number, number, number, number], holes: T.Path[], depth: number, z: number) {
  const [u0, v0, u1, v1] = outline;
  const shape = polyShape([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  shape.holes.push(...holes);
  return k.solo(slab(shape, depth), k.surface(PAL.caseSteel, { holed: true }), [0, 0, z], true);
}

export function caseFrame(g: T.Group) {
  const k = new Kit(g);
  const steel = k.surface(PAL.caseSteel);

  // Floor and roof, each its own mesh so the clearance test sees them where they are.
  for (const y of [0.175, 4.825]) k.solo(rbox(2.2, 0.05, 4.6, 0.02), steel, [0, y, 0]);

  // Top vent: a dark bed with louvres across it.
  const vent = new Kit(g);
  const bed = vent.surface(PAL.black);
  vent.box([1.5, 0.005, 2.8], [0, 4.8525, -0.5], bed, 0.002, 1);
  const louvre = vent.surface(PAL.caseSteel);
  for (let i = 0; i < 15; i++) vent.box([0.05, 0.005, 2.8], [-0.7 + i * 0.1, 4.8575, -0.5], louvre, 0.002, 1);
  vent.flush();

  const feet = new Kit(g);
  const rubber = feet.surface(PAL.black);
  for (const x of [-0.85, 0.85]) for (const z of [-2.0, 2.0]) feet.rod(0.12, 0.15, [x, 0.075, z], "y", rubber, 0.03, 20);
  feet.flush();

  // Rear plate: PSU opening, exhaust fan opening, I/O cut-out and seven expansion slots. The fan and
  // PSU openings are full size so both can leave through them in the exploded view.
  const slotsCut = Array.from({ length: 7 }, (_, i) => rectPath(-0.48, 1.3 + i * 0.2, 0.68, 1.43 + i * 0.2));
  plate(k, [-1.1, 0.2, 1.1, 4.8], [rectPath(-0.78, 0.23, 0.78, 1.14), rectPath(-0.72, 3.13, 0.52, 4.37), rectPath(0.55, 3.25, 0.86, 4.4), ...slotsCut], 0.04, -2.3);

  // Motherboard tray, with the CPU cut-out and cable grommets. Authored flat, then stood up on its edge.
  const trayShape = polyShape([[-2.26, 0.2], [1.9, 0.2], [1.9, 4.72], [-2.26, 4.72]]);
  trayShape.holes.push(rectPath(-1.35, 3.25, -0.55, 4.05), circlePath(0.62, 1.6, 0.12), circlePath(0.62, 2.6, 0.12), circlePath(0.62, 3.6, 0.12));
  const tray = slab(trayShape, 0.02, 0.005).rotateY(-Math.PI / 2);
  k.solo(tray, k.surface(PAL.caseSteel, { holed: true }), [0.97, 0, 0], true);

  // Front fan bracket: two 120 mm mounts, the upper one used.
  plate(k, [-1.05, 0.25, 1.05, 4.75], [rectPath(-0.67, 2.78, 0.57, 4.02), rectPath(-0.67, 1.48, 0.57, 2.72)], 0.03, 2.25);

  for (const x of [-1.075, 1.075]) {
    for (const z of [-2.275, 2.275]) k.solo(rbox(0.05, 4.6, 0.05, 0.012, 1), steel, [x, 2.5, z]);
    k.solo(rbox(0.05, 0.05, 4.6, 0.012, 1), steel, [x, 4.775, 0]);
    k.solo(rbox(0.05, 0.05, 4.6, 0.012, 1), steel, [x, 0.225, 0]);
  }
  k.flush();
}

export function panelLeft(g: T.Group) {
  const k = new Kit(g);
  // The pane spans the whole panel, so its thickness shows at the edge; a black ceramic border is
  // printed on its inner face.
  const glass = new T.Mesh(
    rbox(0.02, 4.56, 4.52, 0.009).clone(),
    new T.MeshStandardMaterial({ color: "#a9c2d4", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  glass.position.set(-1.12, 2.5, 0);
  // Clicks pass through the glass to the part behind it; the black border picks the panel.
  glass.raycast = () => {};
  g.add(glass);

  const frit = k.surface(PAL.black);
  const fx = -1.111;
  k.box([0.007, 0.12, 4.52], [fx, 4.72, 0], frit, 0.002, 1);
  k.box([0.007, 0.12, 4.52], [fx, 0.28, 0], frit, 0.002, 1);
  k.box([0.007, 4.32, 0.12], [fx, 2.5, 2.2], frit, 0.002, 1);
  k.box([0.007, 4.32, 0.12], [fx, 2.5, -2.2], frit, 0.002, 1);

  // Four standoff screws through the corners: a domed head outside, a stem through the glass.
  const chrome = k.surface(PAL.silver);
  for (const y of [0.47, 4.53])
    for (const z of [-2.2, 2.2]) {
      k.rod(0.05, 0.02, [-1.16, y, z], "x", chrome, 0.008, 20);
      k.rod(0.028, 0.04, [-1.13, y, z], "x", chrome, 0, 14);
    }
  k.flush();
}

export function panelRight(g: T.Group) {
  const k = new Kit(g);
  k.box([0.03, 4.6, 4.5], [1.125, 2.5, 0], k.surface(PAL.panel), 0.012, 2);
  k.box([0.006, 3.8, 3.6], [1.143, 2.55, 0.05], k.mat("#454b55", 0.35, 0.42), 0.0025, 1);
  const screw = k.surface(PAL.silver);
  for (const y of [0.33, 4.67]) for (const z of [-2.1, 2.1]) k.rod(0.04, 0.006, [1.143, y, z], "x", screw, 0.002, 6);
  k.flush();
}

export function panelFront(g: T.Group) {
  const k = new Kit(g);
  // The bezel: a steel frame around a 190 x 420 mm opening.
  const bezelShape = rrShape(-1.1, 0.15, 1.1, 4.85, 0.04);
  bezelShape.holes.push(rrPath(-0.95, 0.35, 0.95, 4.55, 0.03));
  k.solo(slab(bezelShape, 0.06, 0.008), k.mat("#2a2d33", 0.3, 0.55, { holed: true }), [0, 0, 2.33], true);

  // The intake: 56 louvres across the opening and five ribs behind them, so the front fan shows
  // through the gaps.
  const mesh = k.mat("#17191d", 0.2, 0.95);
  for (let i = 0; i < 56; i++) k.box([1.92, 0.035, 0.02], [0, 0.375 + i * 0.075, 2.36], mesh, 0.008, 1);
  for (let i = 0; i < 5; i++) k.box([0.03, 4.2, 0.02], [-0.72 + i * 0.36, 2.45, 2.34], mesh, 0.008, 1);

  k.box([0.04, 4.0, 0.012], [-0.98, 2.45, 2.396], k.surface(PAL.black), 0.004, 1);
  k.rod(0.06, 0.02, [0.8, 4.6, 2.4], "z", k.surface(PAL.silver), 0.006, 28);
  k.flush();

  const strip = glowMesh(rbox(0.025, 3.9, 0.01, 0.004, 1).clone(), RGB.violet, 2.4);
  strip.position.set(-0.98, 2.45, 2.404);
  g.add(strip);
}
