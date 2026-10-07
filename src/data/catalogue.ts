/**
 * A small generic parts catalogue for Brief mode and the compatibility rules.
 * All names and specs are invented; sockets, chipsets and generations are generic
 * ("S-Alpha", "V700") so no real brand or product is implied.
 *
 * Spec values are number | string | boolean, so lists are comma separated strings
 * (for example formFactors: "ATX,mATX,ITX"). Read them through the helpers in rules.ts.
 *
 * Deliberate traps, on purpose:
 *  - cpu_vertex_12_new: gen 2 CPU that the V500 board's shipped BIOS cannot boot (needs a flash).
 *  - ram_crest_tall: 54 mm heatspreaders that collide with the tower and dual-tower air coolers.
 */

export type CatalogueKind =
  | "case"
  | "motherboard"
  | "cpu"
  | "cooler"
  | "ram"
  | "gpu"
  | "psu"
  | "nvme"
  | "ssd"
  | "fan";

export const catalogueKinds: CatalogueKind[] = [
  "case",
  "motherboard",
  "cpu",
  "cooler",
  "ram",
  "gpu",
  "psu",
  "nvme",
  "ssd",
  "fan",
];

export interface CatalogueItem {
  id: string;
  kind: CatalogueKind;
  name: string;
  priceUsd: number;
  spec: Record<string, number | string | boolean>;
}

export const catalogue: CatalogueItem[] = [
  // Cases. formFactors = boards that fit; radiatorMounts = AIO sizes (mm) that fit;
  // expansionSlots = slots a card may occupy; psuFormFactors = supplies that fit.
  {
    id: "case_bastion_atx",
    kind: "case",
    name: "Bastion ATX mid tower",
    priceUsd: 110,
    spec: {
      formFactors: "ATX,mATX,ITX",
      gpuMaxLengthMm: 360,
      coolerMaxHeightMm: 165,
      radiatorMounts: "120,240,280,360",
      expansionSlots: 7,
      psuFormFactors: "ATX,SFX",
    },
  },
  {
    id: "case_cube_matx",
    kind: "case",
    name: "Cube mATX compact",
    priceUsd: 90,
    spec: {
      formFactors: "mATX,ITX",
      gpuMaxLengthMm: 300,
      coolerMaxHeightMm: 148,
      radiatorMounts: "120,240",
      expansionSlots: 4,
      psuFormFactors: "SFX",
    },
  },
  {
    id: "case_pocket_itx",
    kind: "case",
    name: "Pocket ITX shoebox",
    priceUsd: 140,
    spec: {
      formFactors: "ITX",
      gpuMaxLengthMm: 305,
      coolerMaxHeightMm: 70,
      radiatorMounts: "120",
      expansionSlots: 3,
      psuFormFactors: "SFX",
    },
  },

  // Motherboards. biosSupportsGen = newest CPU generation the shipped BIOS can boot.
  // epsConnectors = 8-pin CPU power leads the board wants populated.
  {
    id: "mb_foundry_v700_atx",
    kind: "motherboard",
    name: "Foundry V700 ATX",
    priceUsd: 240,
    spec: {
      formFactor: "ATX",
      socket: "S-Beta",
      chipset: "V700",
      ramGen: "DDR5",
      ramSlots: 4,
      m2Slots: 3,
      biosSupportsGen: 2,
      epsConnectors: 2,
    },
  },
  {
    // The BIOS trap board: same socket as the V700, but it ships with a gen 1 BIOS.
    id: "mb_foundry_v500_atx",
    kind: "motherboard",
    name: "Foundry V500 ATX",
    priceUsd: 150,
    spec: {
      formFactor: "ATX",
      socket: "S-Beta",
      chipset: "V500",
      ramGen: "DDR5",
      ramSlots: 4,
      m2Slots: 2,
      biosSupportsGen: 1,
      epsConnectors: 1,
    },
  },
  {
    id: "mb_ridge_v400_matx",
    kind: "motherboard",
    name: "Ridge V400 mATX",
    priceUsd: 95,
    spec: {
      formFactor: "mATX",
      socket: "S-Alpha",
      chipset: "V400",
      ramGen: "DDR4",
      ramSlots: 4,
      m2Slots: 2,
      biosSupportsGen: 2,
      epsConnectors: 1,
    },
  },
  {
    id: "mb_nano_v500_itx",
    kind: "motherboard",
    name: "Nano V500 ITX",
    priceUsd: 200,
    spec: {
      formFactor: "ITX",
      socket: "S-Beta",
      chipset: "V500",
      ramGen: "DDR5",
      ramSlots: 2,
      m2Slots: 2,
      biosSupportsGen: 2,
      epsConnectors: 1,
    },
  },

  // CPUs. gen is the generation within a socket family.
  {
    id: "cpu_vertex_8",
    kind: "cpu",
    name: "Vertex 8-core",
    priceUsd: 279,
    spec: { socket: "S-Beta", gen: 1, tdpW: 105, cores: 8 },
  },
  {
    // The BIOS trap CPU: gen 2 on a socket whose cheaper boards ship a gen 1 BIOS.
    id: "cpu_vertex_12_new",
    kind: "cpu",
    name: "Vertex 12-core (new gen)",
    priceUsd: 349,
    spec: { socket: "S-Beta", gen: 2, tdpW: 120, cores: 12 },
  },
  {
    id: "cpu_apex_16",
    kind: "cpu",
    name: "Apex 16-core",
    priceUsd: 499,
    spec: { socket: "S-Beta", gen: 1, tdpW: 170, cores: 16 },
  },
  {
    id: "cpu_ember_6",
    kind: "cpu",
    name: "Ember 6-core",
    priceUsd: 149,
    spec: { socket: "S-Alpha", gen: 1, tdpW: 65, cores: 6 },
  },

  // Coolers. sockets = brackets in the box; ramClearanceMm = tallest RAM that fits under the fan
  // (airflow coolers only). blocksEps = a big tower that makes the CPU power lead a squeeze.
  {
    id: "cooler_zephyr_slim",
    kind: "cooler",
    name: "Zephyr Slim air",
    priceUsd: 25,
    spec: {
      sockets: "S-Alpha",
      heightMm: 130,
      tdpW: 95,
      type: "air",
      radiatorMm: 0,
      ramClearanceMm: 55,
      blocksEps: false,
    },
  },
  {
    id: "cooler_zephyr_tower",
    kind: "cooler",
    name: "Zephyr Tower air",
    priceUsd: 45,
    spec: {
      sockets: "S-Alpha,S-Beta",
      heightMm: 155,
      tdpW: 150,
      type: "air",
      radiatorMm: 0,
      ramClearanceMm: 44,
      blocksEps: false,
    },
  },
  {
    id: "cooler_monolith_dual",
    kind: "cooler",
    name: "Monolith Dual-Tower air",
    priceUsd: 90,
    spec: {
      sockets: "S-Alpha,S-Beta",
      heightMm: 165,
      tdpW: 250,
      type: "air",
      radiatorMm: 0,
      ramClearanceMm: 40,
      blocksEps: true,
    },
  },
  {
    id: "cooler_tidal_240",
    kind: "cooler",
    name: "Tidal 240 liquid",
    priceUsd: 120,
    spec: {
      sockets: "S-Alpha,S-Beta",
      heightMm: 55,
      tdpW: 250,
      type: "aio",
      radiatorMm: 240,
      ramClearanceMm: 99,
      blocksEps: false,
    },
  },

  // RAM kits. gb is the kit total; sticks is how many modules come in the box.
  {
    id: "ram_pulse_ddr5_32",
    kind: "ram",
    name: "Pulse DDR5 32 GB (2 x 16)",
    priceUsd: 95,
    spec: { gen: "DDR5", heightMm: 34, sticks: 2, gb: 32 },
  },
  {
    id: "ram_pulse_ddr5_64",
    kind: "ram",
    name: "Pulse DDR5 64 GB (4 x 16)",
    priceUsd: 190,
    spec: { gen: "DDR5", heightMm: 34, sticks: 4, gb: 64 },
  },
  {
    // The tall kit that hits the tower and dual-tower air coolers.
    id: "ram_crest_tall",
    kind: "ram",
    name: "Crest DDR5 32 GB tall (2 x 16)",
    priceUsd: 120,
    spec: { gen: "DDR5", heightMm: 54, sticks: 2, gb: 32 },
  },
  {
    // Cheap kit, wrong generation for every DDR5 board.
    id: "ram_pulse_ddr4_32",
    kind: "ram",
    name: "Pulse DDR4 32 GB (2 x 16)",
    priceUsd: 60,
    spec: { gen: "DDR4", heightMm: 34, sticks: 2, gb: 32 },
  },

  // GPUs.
  {
    id: "gpu_nova_8",
    kind: "gpu",
    name: "Nova 8 GB",
    priceUsd: 299,
    spec: { lengthMm: 240, slots: 2, tdpW: 150, pcieConnectors: 1 },
  },
  {
    id: "gpu_nova_12",
    kind: "gpu",
    name: "Nova 12 GB",
    priceUsd: 449,
    spec: { lengthMm: 285, slots: 2, tdpW: 200, pcieConnectors: 1 },
  },
  {
    id: "gpu_nova_16",
    kind: "gpu",
    name: "Nova 16 GB",
    priceUsd: 599,
    spec: { lengthMm: 320, slots: 2.5, tdpW: 300, pcieConnectors: 2 },
  },
  {
    id: "gpu_titan_24",
    kind: "gpu",
    name: "Titan 24 GB",
    priceUsd: 1099,
    spec: { lengthMm: 345, slots: 3.5, tdpW: 450, pcieConnectors: 3 },
  },

  // PSUs.
  {
    id: "psu_anchor_550",
    kind: "psu",
    name: "Anchor 550 W Bronze",
    priceUsd: 60,
    spec: { wattage: 550, formFactor: "ATX", epsConnectors: 1, pcieConnectors: 2, efficiency: "80+ Bronze" },
  },
  {
    id: "psu_anchor_750",
    kind: "psu",
    name: "Anchor 750 W Gold",
    priceUsd: 110,
    spec: { wattage: 750, formFactor: "ATX", epsConnectors: 2, pcieConnectors: 3, efficiency: "80+ Gold" },
  },
  {
    id: "psu_anchor_1000",
    kind: "psu",
    name: "Anchor 1000 W Platinum",
    priceUsd: 190,
    spec: { wattage: 1000, formFactor: "ATX", epsConnectors: 2, pcieConnectors: 4, efficiency: "80+ Platinum" },
  },
  {
    id: "psu_compact_750_sfx",
    kind: "psu",
    name: "Compact 750 W SFX Gold",
    priceUsd: 150,
    spec: { wattage: 750, formFactor: "SFX", epsConnectors: 1, pcieConnectors: 2, efficiency: "80+ Gold" },
  },

  // Storage.
  {
    id: "nvme_flux_g4_1tb",
    kind: "nvme",
    name: "Flux Gen4 1 TB",
    priceUsd: 70,
    spec: { interface: "PCIe 4.0 x4", gb: 1000 },
  },
  {
    id: "nvme_flux_g4_2tb",
    kind: "nvme",
    name: "Flux Gen4 2 TB",
    priceUsd: 130,
    spec: { interface: "PCIe 4.0 x4", gb: 2000 },
  },
  {
    id: "nvme_flux_g5_2tb",
    kind: "nvme",
    name: "Flux Gen5 2 TB",
    priceUsd: 200,
    spec: { interface: "PCIe 5.0 x4", gb: 2000 },
  },
  {
    id: "ssd_stack_1tb",
    kind: "ssd",
    name: "Stack SATA 1 TB",
    priceUsd: 65,
    spec: { interface: "SATA III", gb: 1000 },
  },
  {
    id: "ssd_stack_2tb",
    kind: "ssd",
    name: "Stack SATA 2 TB",
    priceUsd: 120,
    spec: { interface: "SATA III", gb: 2000 },
  },

  // Fans.
  {
    id: "fan_breeze_120",
    kind: "fan",
    name: "Breeze 120 mm",
    priceUsd: 12,
    spec: { sizeMm: 120, rgb: false },
  },
  {
    id: "fan_breeze_120_rgb",
    kind: "fan",
    name: "Breeze 120 mm RGB",
    priceUsd: 18,
    spec: { sizeMm: 120, rgb: true },
  },
  {
    id: "fan_breeze_140",
    kind: "fan",
    name: "Breeze 140 mm",
    priceUsd: 16,
    spec: { sizeMm: 140, rgb: false },
  },
];

export function byKind(kind: CatalogueKind): CatalogueItem[] {
  return catalogue.filter((item) => item.kind === kind);
}

export function getItem(id: string): CatalogueItem {
  const item = catalogue.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown catalogue item: ${id}`);
  return item;
}

/**
 * Total price of a set of items. The build has two fan slots (front and rear), so a fan item
 * is counted twice; everything else is bought once.
 */
export function totalPrice(items: CatalogueItem[]): number {
  return items.reduce((sum, item) => sum + item.priceUsd * (item.kind === "fan" ? 2 : 1), 0);
}
