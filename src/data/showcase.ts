/**
 * The machine on the exploded page, as a configurator's spec sheet: one row per catalogue pick,
 * each naming the sidecar parts it covers, so picking a row picks those parts in 3D. Prices are
 * the catalogue's invented examples.
 */
import { assemblySteps } from "./assembly";
import { getItem, type CatalogueItem, type CatalogueKind } from "./catalogue";
import { checkBuildDetailed, type Build } from "./rules";

export interface SheetRow {
  kind: CatalogueKind;
  /** The row's heading: what the part is, not its product name. */
  label: string;
  item: CatalogueItem;
  /** How many are bought (the two fans). */
  qty: number;
  /** Sidecar part ids this row covers; the first is the one a click selects. */
  parts: string[];
  spec: string;
}

const PICKS: { kind: CatalogueKind; label: string; id: string; qty?: number; parts: string[] }[] = [
  { kind: "case", label: "Case", id: "case_bastion_atx", parts: ["case_frame", "panel_left", "panel_right", "panel_front"] },
  { kind: "motherboard", label: "Motherboard", id: "mb_foundry_v700_atx", parts: ["motherboard"] },
  { kind: "cpu", label: "Processor", id: "cpu_vertex_8", parts: ["cpu"] },
  { kind: "cooler", label: "CPU cooler", id: "cooler_zephyr_tower", parts: ["cooler"] },
  { kind: "ram", label: "Memory", id: "ram_pulse_ddr5_64", parts: ["ram_1", "ram_2", "ram_3", "ram_4"] },
  { kind: "gpu", label: "Graphics card", id: "gpu_nova_16", parts: ["gpu"] },
  { kind: "nvme", label: "Boot drive", id: "nvme_flux_g4_2tb", parts: ["nvme"] },
  { kind: "ssd", label: "Storage", id: "ssd_stack_1tb", parts: ["ssd_sata"] },
  { kind: "psu", label: "Power supply", id: "psu_anchor_750", parts: ["psu", "cables"] },
  { kind: "fan", label: "Case fans", id: "fan_breeze_120_rgb", qty: 2, parts: ["fan_front", "fan_rear"] },
];

const tb = (gb: number) => (gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

/** One line of the spec format a configurator shows, per kind. */
export function specLine(item: CatalogueItem): string {
  const s = item.spec;
  switch (item.kind) {
    case "case":
      return `${String(s.formFactors).split(",")[0]} mid tower · ${s.expansionSlots} slots`;
    case "motherboard":
      return `${s.formFactor} · ${s.socket} · ${s.chipset} · ${s.ramGen}`;
    case "cpu":
      return `${s.cores} cores · ${s.socket} · ${s.tdpW} W`;
    case "cooler":
      return `${s.heightMm} mm tower · ${s.tdpW} W`;
    case "ram":
      return `${s.gen} · ${s.sticks} x ${Number(s.gb) / Number(s.sticks)} GB`;
    case "gpu":
      return `${s.lengthMm} mm · ${s.slots} slot · ${s.tdpW} W`;
    case "nvme":
    case "ssd":
      return `${s.interface} · ${tb(Number(s.gb))}`;
    case "psu":
      return `${s.wattage} W · ${s.efficiency}`;
    case "fan":
      return `${s.sizeMm} mm${s.rgb ? " · RGB" : ""}`;
  }
}

/** The sidecar part ids each kind covers: what a pick of that kind looks like in 3D. */
export const kindParts = Object.fromEntries(PICKS.map((p) => [p.kind, p.parts])) as Record<CatalogueKind, string[]>;

/** The catalogue id picked for each kind on the shipped machine: what the sheet starts from. */
export const defaultPickIds = Object.fromEntries(PICKS.map((p) => [p.kind, p.id])) as Record<CatalogueKind, string>;

export const sheet: SheetRow[] = PICKS.map((p) => {
  const item = getItem(p.id);
  if (item.kind !== p.kind) throw new Error(`${p.id} is a ${item.kind}, not a ${p.kind}`);
  return { kind: p.kind, label: p.label, item, qty: p.qty ?? 1, parts: p.parts, spec: specLine(item) };
});

/** What a set of picks costs: every kind once, the fans at the sheet's quantity. */
export const picksTotal = (picks: Record<CatalogueKind, string>) => sheet.reduce((sum, r) => sum + getItem(picks[r.kind]).priceUsd * r.qty, 0);

export const sheetTotal = sheet.reduce((sum, r) => sum + r.item.priceUsd * r.qty, 0);

/** The finished machine as the rules see it: every pick, every part placed in the guided order. */
export const showcaseBuild: Build = {
  ...Object.fromEntries(sheet.map((r) => [r.kind, r.item])),
  placed: [...new Set(assemblySteps.filter((s) => s.kind === "place").map((s) => s.partId))],
  fanOrientation: { front: "intake", rear: "exhaust" },
};

/** Every rule the sheet passes, for the "Fits" line. A failing rule is a bug in the picks. */
export const sheetChecks = checkBuildDetailed(showcaseBuild);

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** The sheet row covering a sidecar part. */
export function rowFor(partId: string): SheetRow | undefined {
  return sheet.find((r) => r.parts.includes(partId));
}
