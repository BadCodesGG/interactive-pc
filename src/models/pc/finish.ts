/**
 * The PC's surface finishes for the stage's `materials` hook. build-pc.ts authors plain PBR
 * materials (colour, metalness, roughness); this reads each mesh's own colour and old metalness and
 * puts the right real-world surface on it, so the design's colours stay and only the surface changes.
 *
 * Like the stage, this imports three (through the material presets), so it is imported only from the
 * lazy stage chunk: `src/app/stage.tsx` and `src/app/build/build-stage.tsx`.
 */
import { Color, MeshStandardMaterial, type Material, type Mesh } from "three";
import { brushedMetal, glass, satinPlastic, setMaterial, type MaterialHook } from "@/engine/explode/materials";
import type { PartName } from "./build-pc";

export type Finish = "powder" | "board" | "plastic" | "metal" | "polished" | "mesh" | "cable" | "glass" | "keep";

/** A material whose colour, metalness and roughness build-pc.ts authored. */
const isStandard = (m: Material | Material[]): m is MeshStandardMaterial => !Array.isArray(m) && (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/** PCB green: the green channel leads, on a surface the design made non-metallic. */
const isBoardGreen = (c: Color) => c.g > c.r * 1.25 && c.g > c.b;
/** Gold and copper: a warm, saturated colour. */
const isWarmMetal = (c: Color) => c.r > c.b * 1.6 && c.r > c.g;

const FANS: readonly string[] = ["fan_front", "fan_rear"] satisfies PartName[];

/**
 * Which finish a mesh gets, from the part it belongs to and what build-pc.ts authored for it.
 * Exported for the tests; the hook below applies it.
 */
export function finishFor(partId: string, mesh: Mesh): Finish {
  // Lit surfaces (fan rings, strips, bars) are the RGB: the build game fades their emissive, so leave them.
  if (typeof mesh.userData.rgb === "number") return "keep";
  // A mesh can name its own surface when its colour alone would pick the wrong one: a cable's plug
  // is moulded plastic, not sleeving; a modular socket is plastic on a powder-coated supply.
  if (typeof mesh.userData.finish === "string") return mesh.userData.finish as Finish;
  if (mesh.userData.cable) return "cable";
  const mat = mesh.material;
  if (!isStandard(mat)) return "keep";
  if (mat.transparent) return "glass";
  const { color, metalness, roughness } = mat;

  if (partId === "cables") return "cable";
  if (FANS.includes(partId)) return "plastic";
  if (partId === "psu") return "powder";
  if (partId === "panel_right") return "powder";
  // The front intake mesh is the one very rough surface: dark perforated metal.
  if (partId === "panel_front" && roughness >= 0.9) return "mesh";
  if (isWarmMetal(color) && metalness >= 0.3) return "polished";
  if (isBoardGreen(color) && metalness < 0.3) return "board";
  // The card's shroud is moulded plastic; only its trim (and bracket, and contacts) is metal.
  if (partId === "gpu") return metalness >= 0.4 ? "metal" : "plastic";
  if (partId === "case_frame" || partId === "panel_front") return metalness >= 0.3 ? "powder" : "plastic";
  return metalness >= 0.3 ? "metal" : "plastic";
}

/** Dark satin powder-coated steel: a little metal, a satin base and a soft clear coat over it. */
function powderCoat(color: Color) {
  const m = satinPlastic(color);
  m.metalness = 0.3;
  m.roughness = 0.5;
  m.clearcoat = 0.3;
  m.clearcoatRoughness = 0.32;
  return m;
}

/**
 * Machined metal. The preset is fully metallic, which sends a dark base colour (most of this build's
 * aluminium is charcoal) to black: its diffuse is gone and its reflection is tinted by the same dark
 * colour. A little less metal keeps the design's colour readable and still catches the room.
 */
function machined(color: Color) {
  const m = brushedMetal(color);
  m.metalness = 0.75;
  m.roughness = 0.4;
  return m;
}

/**
 * Tempered glass with a cool tint that reflects the room and lets the parts behind it read. It is an
 * alpha-blended pane that writes no depth, not the preset's transmission: a transmissive pane writes
 * depth, which hides everything behind it from ambient occlusion, and shows a copy of the interior
 * drawn before AO. This way the AO pass sees the memory, cooler and card through the glass.
 */
function temperedGlass() {
  const m = glass();
  m.transmission = 0;
  m.transparent = true;
  m.depthWrite = false;
  m.opacity = 0.3;
  m.color.set("#2b3944");
  m.roughness = 0.04;
  // Alpha scales the reflection too, so a high index and full specular keep the room visible in it.
  m.ior = 1.5;
  m.specularIntensity = 1;
  return m;
}

/** The stage's `materials` hook for the PC. Stable identity: a module-level function. */
export const pcFinish: MaterialHook = (mesh, partId) => {
  const finish = finishFor(partId, mesh);
  if (finish === "keep") return;
  const old = (mesh.material as MeshStandardMaterial).color;
  const color = old.clone();
  switch (finish) {
    case "glass":
      // Glass casting a full shadow would darken everything behind it, and a pane does not.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      setMaterial(mesh, temperedGlass());
      return;
    case "powder":
      setMaterial(mesh, powderCoat(color));
      return;
    case "board": {
      const m = satinPlastic(color);
      m.roughness = 0.5;
      m.clearcoat = 0.45;
      m.clearcoatRoughness = 0.25;
      setMaterial(mesh, m);
      return;
    }
    case "plastic":
      setMaterial(mesh, satinPlastic(color));
      return;
    case "metal":
      setMaterial(mesh, machined(color));
      return;
    case "mesh": {
      // Perforated black steel: metal enough to catch the room, not so much that a near-black base goes to nothing.
      const m = machined(color);
      m.metalness = 0.2;
      m.roughness = 0.6;
      setMaterial(mesh, m);
      return;
    }
    case "polished": {
      const m = machined(color);
      m.roughness = 0.28;
      setMaterial(mesh, m);
      return;
    }
    case "cable": {
      // Sleeved cable: matte, no clear coat.
      const m = satinPlastic(color);
      m.roughness = 0.88;
      m.clearcoat = 0;
      setMaterial(mesh, m);
      return;
    }
  }
};
