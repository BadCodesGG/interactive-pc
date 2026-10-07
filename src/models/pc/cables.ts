/**
 * The four power leads: sleeved round tubes along smooth curves, each with a moulded plug at both ends.
 * The build game draws each lead in along its length, so a lead's plugs are one mesh tagged the same way
 * (start plug first, then the far one), and they grow in with the cable instead of floating before it.
 */
import * as T from "three";
import { rbox, type V3 } from "./geo";
import { Kit, PAL, type Surface } from "./kit";

/** A plug: the mating face sits at `tip`, pointing along `dir`; the housing extends back from it. */
interface Plug {
  tip: V3;
  dir: V3;
  /** Which way the retention latch faces. */
  latch: V3;
  /** Housing extent along the latch side, and along the other cross axis. */
  short: number;
  long: number;
  depth: number;
}

function addPlug(k: Kit, mat: T.Material, p: Plug) {
  const z = new T.Vector3(...p.dir).normalize();
  const l = new T.Vector3(...p.latch);
  const x = l.sub(z.clone().multiplyScalar(l.dot(z))).normalize();
  const y = new T.Vector3().crossVectors(z, x);
  const at = (back: number, side = 0) => new T.Vector3(...p.tip).addScaledVector(z, -back).addScaledVector(x, side);
  const basis = (c: T.Vector3) => new T.Matrix4().makeBasis(x, y, z).setPosition(c);
  k.putM(rbox(p.short, p.long, p.depth, 0.012, 2), mat, basis(at(p.depth / 2)));
  k.putM(rbox(p.short * 0.85, p.long * 0.82, 0.05, 0.01, 1), mat, basis(at(p.depth + 0.025)));
  k.putM(rbox(0.02, p.long * 0.5, p.depth * 0.5, 0.006, 1), mat, basis(at(p.depth * 0.45, p.short / 2 + 0.006)));
}

/** A sleeved cable: a tube whose radius dips 6% between braid ridges, so it catches light like sleeving. */
function sleeve(points: V3[], radius: number) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)), false, "centripetal");
  const length = curve.getLength();
  const segments = Math.round(length * 80);
  const radial = 10;
  const geometry = new T.TubeGeometry(curve, segments, radius, radial, false);
  const pos = geometry.getAttribute("position");
  const c = new T.Vector3();
  const p = new T.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const k = 1 - 0.06 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i / segments) * length) / 0.12));
    for (let j = 0; j <= radial; j++) {
      const n = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, n).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(n, p.x, p.y, p.z);
    }
  }
  geometry.computeVertexNormals();
  // The tube's seam is two rows of vertices; give both the same normal so no line shows.
  const nor = geometry.getAttribute("normal");
  for (let i = 0; i <= segments; i++) {
    const a = i * (radial + 1);
    const b = a + radial;
    p.set(nor.getX(a) + nor.getX(b), nor.getY(a) + nor.getY(b), nor.getZ(a) + nor.getZ(b)).normalize();
    nor.setXYZ(a, p.x, p.y, p.z);
    nor.setXYZ(b, p.x, p.y, p.z);
  }
  return geometry;
}

export function cables(g: T.Group) {
  const lead = (points: V3[], radius: number, surface: Surface, start: Plug, end: Plug) => {
    const k = new Kit(g);
    k.solo(sleeve(points, radius), k.surface(surface, { cable: true }), [0, 0, 0], true);
    const housing = k.mat("#15171a", 0.1, 0.6, { finish: "plastic", cable: true, holed: true });
    addPlug(k, housing, start);
    addPlug(k, housing, end);
    k.flush();
  };
  /** A plug into the supply's connector panel, at the start of a lead. */
  const atSupply = (x: number, y: number, long: number, short: number): Plug => ({ tip: [x, y, -0.575], dir: [0, 0, -1], latch: [0, 1, 0], short, long, depth: 0.1 });

  // 24-pin: from the supply, forward past the end of the card, up, and into the board's edge.
  lead(
    [[0.35, 0.95, -0.55], [0.45, 1.05, 0.2], [0.55, 1.3, 1.25], [0.6, 2.4, 1.32], [0.65, 3.1, 1.2], [0.74, 3.25, 0.5], [0.74, 3.25, 0.38]],
    0.07,
    PAL.sleeve,
    atSupply(0.35, 0.95, 0.16, 0.1),
    { tip: [0.74, 3.25, 0.37], dir: [0, 0, -1], latch: [-1, 0, 0], short: 0.1, long: 0.55, depth: 0.12 },
  );
  // 8-pin CPU: up the rear edge beside the board, over the I/O cover, into the top corner.
  lead(
    [[0.6, 1.0, -0.55], [0.76, 1.3, -0.95], [0.78, 1.7, -1.9], [0.78, 2.85, -1.92], [0.5, 3.15, -1.92], [0.48, 3.5, -1.9], [0.48, 4.3, -1.9], [0.6, 4.52, -1.87], [0.72, 4.45, -1.85]],
    0.045,
    PAL.sleeve,
    atSupply(0.6, 1.0, 0.14, 0.09),
    { tip: [0.742, 4.45, -1.85], dir: [1, 0, 0], latch: [0, 1, 0], short: 0.1, long: 0.2, depth: 0.09 },
  );
  // PCIe: forward and up to the socket on the end of the card.
  lead(
    [[-0.2, 0.9, -0.55], [-0.35, 1.0, 0.4], [-0.3, 1.4, 1.36], [-0.1, 2.0, 1.4], [0.0, 2.45, 1.26], [0.0, 2.45, 1.14]],
    0.05,
    ["#1b1d21", 0.15, 0.5],
    atSupply(-0.2, 0.9, 0.14, 0.08),
    { tip: [0.0, 2.45, 1.13], dir: [0, 0, -1], latch: [0, 1, 0], short: 0.14, long: 0.2, depth: 0.1 },
  );
  // SATA power: to the grommet behind which the drive sits.
  lead(
    [[0.2, 0.9, -0.55], [0.5, 0.88, 0.3], [0.85, 0.9, 0.9], [0.93, 0.95, 1.2]],
    0.03,
    PAL.sleeve,
    atSupply(0.2, 0.9, 0.09, 0.05),
    { tip: [0.93, 0.95, 1.2], dir: [0.25, 0.16, 0.95], latch: [0, 1, 0], short: 0.05, long: 0.06, depth: 0.07 },
  );
}
