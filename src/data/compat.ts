/**
 * Compatibility status per sheet row: the rules in rules.ts, read as Fits, Check or Won't fit.
 *
 * `checkBuildDetailed` answers per rule; a sheet row is per part, so each rule is mapped to the
 * kinds whose swap could resolve it. A row takes its worst mapped result: a block is Won't fit, a
 * warning is Check, nothing failing is Fits. Pure data, no React and no three.
 */
import { byKind, catalogueKinds, getItem, type CatalogueKind } from "./catalogue";
import { checkBuildDetailed, type Build } from "./rules";

export type CompatStatus = "fits" | "check" | "wont-fit";
export const STATUS_LABEL: Record<CompatStatus, string> = { fits: "Fits", check: "Check", "wont-fit": "Won't fit" };

/** The catalogue id picked for each kind. */
export type Picks = Record<CatalogueKind, string>;

/**
 * Which rows a rule is shown on. The power supply check is on the supply alone: the reason names the
 * card and CPU, and putting it on them too would turn three rows red for one problem.
 */
export const RULE_KINDS: Record<string, CatalogueKind[]> = {
  form_factor: ["case", "motherboard"],
  cpu_socket: ["cpu", "motherboard"],
  bios_chipset: ["cpu", "motherboard"],
  ram_compat: ["ram", "motherboard"],
  cooler_socket_tdp: ["cooler", "cpu"],
  cooler_fit: ["cooler", "case"],
  ram_tower_clearance: ["ram", "cooler"],
  gpu_fit: ["gpu", "case"],
  psu_power: ["psu"],
  fan_orientation: ["fan"],
};

/** Rules about how a build is put together rather than which parts were picked: no row to show them on. */
export const COMPAT_EXCLUDED_RULES = ["access_order"];

export interface RowCompat {
  status: CompatStatus;
  /** A sentence: the failing rule's reason, or how many checks the part passes. */
  reason: string;
  /** The failing rules that set the status, worst severity only. */
  ruleIds: string[];
}

export interface CompatReport {
  rows: Record<CatalogueKind, RowCompat>;
  overall: CompatStatus;
  /** Checks that apply to the picks (hidden rules and excluded rules are not counted). */
  total: number;
  passed: number;
  /** Labels of the rules that fail. */
  failing: string[];
}

/** The picks as the rules see them. `placed` stays empty: the picks are judged, not the order they go in. */
export function buildFor(picks: Picks): Build {
  const build: Build = { placed: [], fanOrientation: { front: "intake", rear: "exhaust" } };
  for (const kind of catalogueKinds) build[kind] = getItem(picks[kind]);
  return build;
}

const plural = (n: number) => `${n} check${n === 1 ? "" : "s"}`;

export function compatReport(picks: Picks, opts: { hiddenRuleIds?: readonly string[] } = {}): CompatReport {
  const hidden = new Set(opts.hiddenRuleIds ?? []);
  const results = checkBuildDetailed(buildFor(picks)).filter(({ rule }) => !COMPAT_EXCLUDED_RULES.includes(rule.id) && !hidden.has(rule.id));

  const rows = {} as Record<CatalogueKind, RowCompat>;
  for (const kind of catalogueKinds) {
    const mine = results.filter(({ rule }) => RULE_KINDS[rule.id]?.includes(kind));
    const failed = mine.flatMap(({ rule, result }) => (result.ok ? [] : [{ id: rule.id, result }]));
    const blocked = failed.filter((f) => f.result.severity === "block");
    const top = blocked.length > 0 ? blocked : failed;
    if (top.length === 0) rows[kind] = { status: "fits", reason: `Passes ${plural(mine.length)}.`, ruleIds: [] };
    else rows[kind] = { status: blocked.length > 0 ? "wont-fit" : "check", reason: top[0].result.reason, ruleIds: top.map((f) => f.id) };
  }

  const failing = results.filter(({ result }) => !result.ok);
  const overall: CompatStatus = failing.some(({ result }) => !result.ok && result.severity === "block") ? "wont-fit" : failing.length > 0 ? "check" : "fits";
  return { rows, overall, total: results.length, passed: results.length - failing.length, failing: failing.map(({ rule }) => rule.label) };
}

/** Every catalogue item of a kind with the status it would have if swapped in: what a row's swap list shows. */
export function alternativesFor(picks: Picks, kind: CatalogueKind, opts: { hiddenRuleIds?: readonly string[] } = {}) {
  return byKind(kind).map((item) => ({ item, compat: compatReport({ ...picks, [kind]: item.id }, opts).rows[kind] }));
}
