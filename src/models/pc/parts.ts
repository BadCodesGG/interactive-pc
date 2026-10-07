/**
 * Small mechanical pieces: axial fans, plus the glow material for RGB.
 *
 * Adapted from pc-anatomy by Yoosseph (https://github.com/Yoosseph/pc-anatomy), lib/parts.ts,
 * Copyright (c) 2026 Yoseph, MIT License (see LICENSE-pc-anatomy.txt in this folder). Changes:
 * the blades are one merged mesh instead of an InstancedMesh (the explode engine outlines and
 * measures plain meshes), the frame and hub have rounded edges, and the RGB surfaces and rotors
 * are tagged in `userData` so the build game can fade and spin them.
 *
 * Everything is built around the origin and blows or stacks along +Y; callers place and rotate it.
 */
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cyl, rbox, slab } from "./geo";

export type MaterialFn = (color: string, metal?: number, rough?: number) => T.MeshStandardMaterial;

/** A plain PBR material. Every mesh gets its own, so the engine can tint one part at a time. */
export const material: MaterialFn = (color, metal = 0.2, rough = 0.6) =>
  new T.MeshStandardMaterial({ color, metalness: metal, roughness: rough });

/**
 * A surface that reads as its own light source: lit fan rings, strips and bars. Tagged
 * `userData.rgb` with its full intensity, so the build game can start it dark and fade it in.
 */
export function glowMaterial(color: string, intensity = 2.2, opacity = 1) {
  const m = new T.MeshStandardMaterial({
    color: "#0b0c0d",
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.45,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
    side: opacity < 1 ? T.DoubleSide : T.FrontSide,
  });
  return m;
}

/** A mesh whose material is a glow material, tagged so the game can find every RGB surface. */
export function glowMesh(geometry: T.BufferGeometry, color: string, intensity = 2.2, opacity = 1) {
  const mesh = new T.Mesh(geometry, glowMaterial(color, intensity, opacity));
  mesh.userData.rgb = intensity;
  return mesh;
}

/** One fan blade: a swept, cambered, twisted surface with real thickness and closed edges. */
function bladeGeometry(inner: number, outer: number, thickness: number) {
  const verts: number[] = [];
  const indices: number[] = [];
  const rows = 10;
  const cols = 5;
  for (let side = 0; side < 2; side++)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const t = r / (rows - 1);
        const u = c / (cols - 1) - 0.5;
        const chord = 0.46 + 0.34 * t - 0.22 * t * t;
        const radius = inner + t * (outer - inner);
        const angle = 0.52 * Math.pow(t, 1.15) + u * chord;
        const camber = Math.cos(u * Math.PI) * 0.09 * (1 - 0.45 * t);
        const pitch = u * (0.42 - 0.16 * t);
        const skin = thickness * (1 - 0.55 * t) * (1 - Math.abs(u) * 0.7);
        verts.push(Math.cos(angle) * radius, (camber + pitch) * outer + (side ? skin : -skin), Math.sin(angle) * radius);
      }
  for (let side = 0; side < 2; side++)
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = side * rows * cols + r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        indices.push(...(side ? [a, d, b, b, d, e] : [a, b, d, b, e, d]));
      }
  const layer = rows * cols;
  for (let r = 0; r < rows - 1; r++)
    for (const c of [0, cols - 1]) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      indices.push(a, a + layer, b, b, a + layer, b + layer);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Square frame with a circular bore, rounded corners and mounting holes. */
function fanFrame(size: number, depth: number) {
  const half = size / 2;
  const radius = size * 0.075;
  const shape = new T.Shape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  const bore = new T.Path();
  bore.absarc(0, 0, size * 0.474, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const hole = new T.Path();
      hole.absarc(sx * half * 0.835, sy * half * 0.835, size * 0.034, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  // Edges rounded inward, so the frame keeps its size.
  const geometry = slab(shape, depth, size * 0.012, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -depth / 2, 0);
  return geometry;
}

export interface FanOptions {
  /** Frame edge length: a 120 mm fan is 1.2 at 1 unit = 100 mm. */
  size: number;
  blades?: number;
  frameColor?: string;
  bladeColor?: string;
  /** Rotational offset so a row of fans does not look stamped from one part. */
  phase?: number;
  /** Rubber corner pads, as case fans have. */
  pads?: boolean;
  /** Lit diffuser ring on the +Y face. */
  rgb?: string;
}

/**
 * An axial fan blowing along +Y: frame, hub, swept blades, motor struts. The rotor is tagged
 * `userData.spin` (radians per second at full speed) so the game can spin it about its local Y.
 */
export function buildFan({ size, blades = 9, frameColor = "#2b3035", bladeColor = "#3c434a", phase = 0, pads = false, rgb }: FanOptions) {
  const group = new T.Group();
  const depth = size * 0.213;
  const half = size / 2;
  group.add(new T.Mesh(fanFrame(size, depth), material(frameColor, 0.22, 0.58)));

  const rotor = new T.Group();
  rotor.userData.spin = 26;
  const hubRadius = size * 0.163;
  const hubHeight = depth * 0.78;
  rotor.add(new T.Mesh(cyl(hubRadius, hubHeight, hubRadius * 0.28, 28).clone(), material("#24282d", 0.3, 0.45)));
  // The motor cap: a slightly lighter disc, proud of the hub on the intake face.
  const cap = new T.Mesh(cyl(hubRadius * 0.64, 0.008, 0.003, 24).clone(), material("#30353b", 0.3, 0.4));
  cap.position.y = hubHeight / 2 - 0.002;
  rotor.add(cap);
  const blade = bladeGeometry(hubRadius * 0.96, size * 0.462, size * 0.011);
  const copies: T.BufferGeometry[] = [];
  for (let i = 0; i < blades; i++) copies.push(blade.clone().rotateY(phase + (i / blades) * Math.PI * 2));
  rotor.add(new T.Mesh(mergeGeometries(copies), material(bladeColor, 0.26, 0.52)));
  blade.dispose();
  for (const c of copies) c.dispose();
  group.add(rotor);

  const strut = new T.BoxGeometry(size * 0.03, depth * 0.14, size * 0.44);
  const arms: T.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.35;
    arms.push(strut.clone().translate(0, -depth * 0.41, size * 0.25).rotateY(a));
  }
  group.add(new T.Mesh(mergeGeometries(arms), material(frameColor, 0.24, 0.56)));
  strut.dispose();

  if (pads) {
    const pad = rbox(size * 0.15, depth * 1.03, size * 0.15, size * 0.02, 1);
    const pieces: T.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pieces.push(pad.clone().translate(sx * half * 0.85, 0, sy * half * 0.85));
    group.add(new T.Mesh(mergeGeometries(pieces), material("#101213", 0.02, 0.94)));
  }

  if (rgb) {
    const ring = glowMesh(new T.TorusGeometry(size * 0.43, size * 0.022, 8, 48), rgb, 2.6);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = depth * 0.52;
    group.add(ring);
  }
  return group;
}

/** A fan placed at `at` (world position), blowing out of the face named by `facing`. */
export function fanAt(g: T.Group, at: [number, number, number], size: number, facing: "+z" | "-z" | "-y", rgb?: string, pads = true) {
  const fan = buildFan({ size, pads, rgb, phase: at[0] + at[2] });
  if (facing === "+z") fan.rotation.x = Math.PI / 2;
  if (facing === "-z") fan.rotation.x = -Math.PI / 2;
  if (facing === "-y") fan.rotation.x = Math.PI;
  fan.position.set(...at);
  g.add(fan);
  return fan;
}
