/**
 * Thermal maths for the stage's heat overlay: how hot each part looks, 0 (cool) to 1 (as hot as the
 * model goes), from the picks' TDP and the fans' airflow. Keyed by sidecar part id, since the overlay
 * tints meshes, not catalogue kinds. Pure data and arithmetic: no three, no React.
 *
 * The model, deliberately simple and invented like the parts:
 *   heat = watts / limit, then relieved by airflow, then clamped to 0..1.
 * `limit` is how many watts the part can shed before it counts as hot (for the CPU, the cooler's own
 * rating, so a cooler too small for its CPU runs at or past 1). Airflow relieves up to AIRFLOW_RELIEF
 * of the heat, saturating as the fans get stronger.
 *
 * The catalogue carries a fan's size but no airflow, and only the CPU, GPU and cooler have a TDP, so
 * the fan airflow by size, the memory, drive and board wattages and the supply efficiencies below are
 * assumptions that live here.
 */
import { getItem, type CatalogueItem, type CatalogueKind } from "./catalogue";
import type { Picks } from "./compat";
import { kindParts } from "./showcase";
import type { FanOrientation } from "./rules";

/** Assumed airflow per fan by size, cubic feet per minute. */
export const FAN_CFM: Record<number, number> = { 120: 55, 140: 75 };
/** The airflow at which the fans have done half of what they can. */
const FLOW_REF_CFM = 60;
/** The most airflow can take off a part's heat. */
const AIRFLOW_RELIEF = 0.35;
/** A fan that blows the same way as the other still moves some air through the case. */
const UNBALANCED_SHARE = 0.35;

const GPU_LIMIT_W = 450;
const BOARD_BASE_W = 8;
const BOARD_PER_CPU_W = 0.12;
const BOARD_LIMIT_W = 40;
const RAM_STICK_W = 4;
const RAM_LIMIT_W = 8;
const NVME_W = 7;
const NVME_GEN5_W = 11;
const NVME_LIMIT_W = 12;
const SSD_W = 3;
const SSD_LIMIT_W = 8;
const PSU_LIMIT_W = 80;
/** Fraction of the wall power a supply turns into useful power, by its rating. */
const PSU_EFFICIENCY: Record<string, number> = { Bronze: 0.85, Gold: 0.9, Platinum: 0.92 };
/** A cooler's fins run a little cooler than the CPU they carry. */
const COOLER_SHARE = 0.9;

export type FanSetup = { front?: FanOrientation; rear?: FanOrientation };
const DEFAULT_FANS: FanSetup = { front: "intake", rear: "exhaust" };

const num = (item: CatalogueItem, key: string): number => {
  const v = item.spec[key];
  if (typeof v !== "number") throw new Error(`${item.id}: spec "${key}" must be a number`);
  return v;
};
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Airflow through the case in CFM: the smaller of what the intake fans pull in and the exhaust fans
 * push out, plus a share of the imbalance. Two same-size fans, one in and one out, give one fan's worth.
 */
export function airflowCfm(picks: Picks, fans: FanSetup = DEFAULT_FANS): number {
  const fan = getItem(picks.fan);
  const cfm = FAN_CFM[num(fan, "sizeMm")] ?? 0;
  const intake = [fans.front, fans.rear].filter((o) => o === "intake").length * cfm;
  const exhaust = [fans.front, fans.rear].filter((o) => o === "exhaust").length * cfm;
  return Math.min(intake, exhaust) + UNBALANCED_SHARE * Math.abs(intake - exhaust);
}

/** How much of a part's heat the airflow takes away, as a multiplier. */
const relief = (cfm: number) => 1 - AIRFLOW_RELIEF * (cfm / (cfm + FLOW_REF_CFM));

export interface ThermalMap {
  /** 0 to 1 for every sidecar part; parts that make no heat are 0. */
  heat: Record<string, number>;
  airflowCfm: number;
  /** The CPU makes more heat than its cooler is rated to remove. */
  throttling: boolean;
}

export function thermalMap(picks: Picks, fans: FanSetup = DEFAULT_FANS): ThermalMap {
  const item = (kind: CatalogueKind) => getItem(picks[kind]);
  const cpu = item("cpu");
  const gpu = item("gpu");
  const cooler = item("cooler");
  const ram = item("ram");
  const nvme = item("nvme");
  const psu = item("psu");

  const cpuW = num(cpu, "tdpW");
  const gpuW = num(gpu, "tdpW");
  const coolerW = num(cooler, "tdpW");
  const boardW = BOARD_BASE_W + BOARD_PER_CPU_W * cpuW;
  const nvmeW = String(nvme.spec.interface).includes("5.0") ? NVME_GEN5_W : NVME_W;
  const sticks = num(ram, "sticks");
  const draw = cpuW + gpuW + boardW + sticks * RAM_STICK_W + nvmeW + SSD_W;
  const eff = PSU_EFFICIENCY[String(psu.spec.efficiency).replace("80+ ", "")] ?? PSU_EFFICIENCY.Bronze;
  const psuLossW = draw * (1 / eff - 1);

  const cfm = airflowCfm(picks, fans);
  const f = relief(cfm);
  const at = (watts: number, limit: number) => clamp01((watts / limit) * f);

  const heat: Record<string, number> = {};
  for (const kind of Object.keys(kindParts) as CatalogueKind[]) for (const id of kindParts[kind]) heat[id] = 0;
  // The case and the panels and the cables make none. Two sticks sit in slots 2 and 4, as the guided build does.
  const cpuHeat = at(cpuW, coolerW);
  heat.cpu = cpuHeat;
  heat.cooler = clamp01(cpuHeat * COOLER_SHARE);
  heat.gpu = at(gpuW, GPU_LIMIT_W);
  heat.motherboard = at(boardW, BOARD_LIMIT_W);
  for (const id of sticks >= 4 ? ["ram_1", "ram_2", "ram_3", "ram_4"] : ["ram_2", "ram_4"].slice(0, sticks)) heat[id] = at(RAM_STICK_W, RAM_LIMIT_W);
  heat.nvme = at(nvmeW, NVME_LIMIT_W);
  heat.ssd_sata = at(SSD_W, SSD_LIMIT_W);
  heat.psu = at(psuLossW, PSU_LIMIT_W);
  return { heat, airflowCfm: cfm, throttling: cpuW > coolerW };
}
