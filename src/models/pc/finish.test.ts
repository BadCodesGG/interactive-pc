import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildPc } from "./build-pc";
import { finishFor, pcFinish, type Finish } from "./finish";

/** Every mesh of the PC with its part id and its authored colour, before the hook runs. */
function meshes() {
  const { root } = buildPc();
  const out: { mesh: THREE.Mesh; part: string; color: string; finish: Finish }[] = [];
  for (const part of root.children) {
    part.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const color = (mesh.material as THREE.MeshStandardMaterial).color.getHexString();
      out.push({ mesh, part: part.name, color, finish: finishFor(part.name, mesh) });
    });
  }
  return out;
}

describe("pcFinish", () => {
  it("leaves the RGB surfaces alone: the build game fades their emissive", () => {
    const rgb = meshes().filter((m) => typeof m.mesh.userData.rgb === "number");
    expect(rgb.length).toBeGreaterThan(4);
    for (const m of rgb) {
      const before = m.mesh.material;
      pcFinish(m.mesh, m.part);
      expect(m.mesh.material).toBe(before);
      expect(m.finish).toBe("keep");
    }
  });

  it("keeps every other mesh's colour and makes it a physical material", () => {
    for (const m of meshes()) {
      if (m.finish === "keep") continue;
      pcFinish(m.mesh, m.part);
      const mat = m.mesh.material as THREE.MeshPhysicalMaterial;
      expect(mat.isMeshPhysicalMaterial, `${m.part} ${m.color}`).toBe(true);
      // Glass is tinted on purpose; every other finish keeps the design's colour.
      if (m.finish !== "glass") expect(mat.color.getHexString(), `${m.part}`).toBe(m.color);
    }
  });

  it("makes the side panel's pane tempered glass that casts no shadow, and its frame powder coat", () => {
    const panel = meshes().filter((m) => m.part === "panel_left");
    const pane = panel.find((m) => m.finish === "glass")!;
    expect(panel.filter((m) => m.finish === "glass")).toHaveLength(1);
    pcFinish(pane.mesh, pane.part);
    const mat = pane.mesh.material as THREE.MeshPhysicalMaterial;
    // Alpha-blended and depth-less, so the AO pass can see the interior through it.
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.transmission).toBe(0);
    expect(mat.opacity).toBeLessThan(0.5);
    expect(pane.mesh.castShadow).toBe(false);
    // Clicks still pass through the pane to the part behind it.
    expect(pane.mesh.raycast).not.toBe(THREE.Mesh.prototype.raycast);
    expect(panel.some((m) => m.finish === "plastic")).toBe(true);
  });

  it("puts the right surface on the parts the design names", () => {
    const all = meshes();
    const finishes = (part: string) => new Set(all.filter((m) => m.part === part).map((m) => m.finish));
    expect(finishes("case_frame")).toEqual(new Set(["powder", "plastic"]));
    expect(finishes("panel_right")).toEqual(new Set(["powder"]));
    expect(finishes("panel_front").has("mesh")).toBe(true); // the intake mesh
    expect(finishes("motherboard").has("board")).toBe(true);
    expect(finishes("cooler").has("metal")).toBe(true); // the fins
    expect(finishes("cooler").has("polished")).toBe(true); // the copper pipes and base
    expect(finishes("ram_1").has("board")).toBe(true);
    expect(finishes("ram_1").has("metal")).toBe(true); // the spreaders
    expect(finishes("fan_front")).toEqual(new Set(["plastic", "keep"]));
    expect(finishes("cables")).toEqual(new Set(["cable", "plastic"])); // sleeving, and the moulded plugs
    expect(finishes("psu")).toEqual(new Set(["powder", "plastic"])); // the enclosure, and the modular sockets
  });

  it("makes the GPU shroud plastic with metal trim, and never a metal shroud", () => {
    const gpu = meshes().filter((m) => m.part === "gpu");
    const shroud = gpu.find((m) => m.color === "353a42")!;
    const trim = gpu.find((m) => m.color === "434952")!;
    expect(shroud.finish).toBe("plastic");
    expect(trim.finish).toBe("metal");
    pcFinish(shroud.mesh, "gpu");
    expect((shroud.mesh.material as THREE.MeshPhysicalMaterial).metalness).toBe(0);
  });

  it("lets a mesh name its own surface, ahead of its colour and its cable tag", () => {
    const { mesh, part } = meshes().find((m) => m.part === "cables" && m.mesh.userData.finish === "plastic")!;
    expect(mesh.userData.cable).toBe(true);
    expect(finishFor(part, mesh)).toBe("plastic");
    pcFinish(mesh, part);
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    expect(mat.roughness).toBeLessThan(0.8); // not the sleeving's matte weave
    expect(mat.clearcoat).toBeGreaterThan(0);
    // The RGB rule still comes first.
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    lit.userData.rgb = 2;
    lit.userData.finish = "metal";
    expect(finishFor("gpu", lit)).toBe("keep");
  });

  it("gives the new detail the surface a real part has", () => {
    const all = meshes();
    const finishOf = (part: string, color: string) => new Set(all.filter((m) => m.part === part && m.color === color).map((m) => m.finish));
    expect(finishOf("gpu", "434952")).toEqual(new Set(["metal"])); // backplate and trim
    expect(finishOf("gpu", "c9ced4")).toEqual(new Set(["metal"])); // bracket
    expect(finishOf("gpu", "c3cacf")).toEqual(new Set(["metal"])); // heatsink fins
    expect(finishOf("gpu", "d38c58")).toEqual(new Set(["polished"])); // heat pipes
    expect(finishOf("gpu", "1f2227")).toEqual(new Set(["plastic"])); // port housings and power socket
    expect(finishOf("motherboard", "1b1f24")).toEqual(new Set(["plastic"])); // capacitor cans
    expect(finishOf("motherboard", "9aa1a8")).toEqual(new Set(["metal"])); // their lids
    expect(finishOf("motherboard", "8c7a5c")).toEqual(new Set(["plastic"])); // tan SMD parts
    expect(finishOf("motherboard", "d6b56a")).toEqual(new Set(["polished"])); // gold SMD parts
    expect(finishOf("cooler", "c3cacf")).toEqual(new Set(["metal"])); // fins
    expect(finishOf("panel_front", "17191d")).toEqual(new Set(["mesh"])); // louvres
    expect(finishOf("panel_front", "2a2d33")).toEqual(new Set(["powder"])); // bezel
    expect(finishOf("psu", "15171a")).toEqual(new Set(["powder"])); // underside grille
  });

  it("makes cables matte with no clear coat", () => {
    const cable = meshes().find((m) => m.part === "cables" && m.finish === "cable")!;
    pcFinish(cable.mesh, cable.part);
    const mat = cable.mesh.material as THREE.MeshPhysicalMaterial;
    expect(mat.roughness).toBeGreaterThan(0.8);
    expect(mat.clearcoat).toBe(0);
  });
});
