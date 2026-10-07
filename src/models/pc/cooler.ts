/**
 * The CPU cooler: a tower of 40 thin fins threaded by two U-shaped heat pipes, a copper base on the
 * chip, a clamp bracket, a top cap and the lit fan on its front face.
 */
import * as T from "three";
import { rrShape } from "./geo";
import { Kit, PAL, RGB } from "./kit";
import { fanAt } from "./parts";

const CENTRE: [number, number, number] = [0, 3.65, -0.95];
/** Pipe heights in the fin stack, and where they leave the base (relative to the tower's axis). */
const PIPES = [
  { inStack: [-0.24, -0.08], atBase: [-0.18, -0.06] },
  { inStack: [0.08, 0.24], atBase: [0.06, 0.18] },
] as const;

/** One fin: a rounded plate with four pipe holes, thin along x. Built once. */
let finGeo: T.BufferGeometry | undefined;
function fin() {
  if (!finGeo) {
    const shape = rrShape(-0.25, -0.625, 0.25, 0.625, 0.02);
    for (const dy of [-0.24, -0.08, 0.08, 0.24]) shape.holes.push(new T.Path().absarc(0, dy, 0.033, 0, Math.PI * 2, true));
    finGeo = new T.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false, curveSegments: 10 }).rotateY(Math.PI / 2).translate(-0.006, 0, 0);
  }
  return finGeo;
}

/** A U-shaped pipe: out of the base, through the stack, round a bend at the far end and back. */
function uPipe(inStack: readonly [number, number], atBase: readonly [number, number]) {
  const [fa, fb] = inStack;
  const [ba, bb] = atBase;
  const xs = -0.58; // where the bend starts
  const r = Math.abs(fb - fa) / 2;
  const s = Math.sign(fb - fa);
  const pts: [number, number][] = [[0.75, ba], [0.69, ba], [0.62, fa]];
  for (let x = 0.4; x > xs + 0.1; x -= 0.3) pts.push([x, fa]);
  pts.push([xs, fa]);
  for (let i = 1; i < 8; i++) {
    const phi = (i / 8) * Math.PI;
    pts.push([xs - r * Math.sin(phi), fa + s * (r - r * Math.cos(phi))]);
  }
  pts.push([xs, fb]);
  for (let x = xs + 0.3; x < 0.45; x += 0.3) pts.push([x, fb]);
  pts.push([0.62, fb], [0.69, bb], [0.75, bb]);
  const curve = new T.CatmullRomCurve3(pts.map(([x, dy]) => new T.Vector3(x, CENTRE[1] + dy, CENTRE[2])), false, "centripetal");
  return new T.TubeGeometry(curve, 160, 0.03, 12, false);
}

export function cooler(g: T.Group) {
  const k = new Kit(g);
  const aluminium = k.surface(PAL.alu);
  // 40 fins, 3.2 mm apart, plate faces toward the fan.
  for (let i = 0; i < 40; i++) k.put(fin(), aluminium, [-0.06 + (i - 19.5) * 0.032, CENTRE[1], CENTRE[2]]);

  const copper = k.surface(PAL.copper);
  k.box([0.03, 0.4, 0.4], [0.78, 3.65, -0.95], copper, 0.008, 1);
  for (const p of PIPES) k.solo(uPipe(p.inStack, p.atBase), copper, [0, 0, 0], true);

  // The clamp bracket with its four spring screws.
  const bracket = k.mat("#2c3036", 0.3, 0.45);
  k.box([0.06, 0.5, 0.5], [0.735, 3.65, -0.95], bracket, 0.012, 2);
  const screw = k.surface(PAL.silver);
  for (const dy of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) k.rod(0.03, 0.015, [0.6975, 3.65 + dy, -0.95 + dz], "x", screw, 0.004, 12);

  // The cap at the glass end, with a brushed inlay.
  k.box([0.034, 1.27, 0.52], [-0.717, 3.65, -0.95], k.mat("#2a2e34", 0.3, 0.45), 0.014, 2);
  k.box([0.006, 1.1, 0.4], [-0.737, 3.65, -0.95], k.mat("#3a4048", 0.4, 0.4), 0.003, 1);
  k.flush();

  fanAt(g, [-0.06, 3.65, -0.572], 1.2, "+z", RGB.cyan, false);
}

