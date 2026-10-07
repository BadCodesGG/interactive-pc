/**
 * Free build: which placements are physically impossible, as opposed to merely not the recommended
 * order. The guided order (`after` in src/data/assembly.ts) is a recommendation; Free keeps only the
 * true blockers.
 *
 * Two sources, both derived from data that already exists:
 * - `FREE_NEEDS`: the steps that must be done first because the part could not physically go in
 *   without them. Every entry is a subset of what the guided `after` lists imply (asserted in
 *   free-rules.test.ts), so any guided build is a valid free build.
 * - the `access_order` rule in src/data/rules.ts (cooler over the CPU, memory under a tower, the
 *   NVMe under the card, panels last), which says what a placement costs once it is made. It also
 *   answers with warnings for things that are a squeeze, not an impossibility: those go through.
 *
 * A placement that the rule would block later (the card before the NVMe drive) is refused now by a
 * prerequisite, so a player can never be left with a part that cannot go in.
 */
import { assemblySteps, wrongOrderMessage, type AssemblyStep } from "@/data/assembly";
import { buildFor, type Picks } from "@/data/compat";
import { rules } from "@/data/rules";
import { defaultPickIds } from "@/data/showcase";
import { getItem } from "@/data/catalogue";

const place = assemblySteps.filter((s) => s.kind === "place");
const isPanel = (s: AssemblyStep) => s.partId.startsWith("panel_");

/** The steps a step needs done first, however the player got there. Panels need everything else that is not optional. */
export const FREE_NEEDS: Record<string, string[]> = {
  psu: [],
  board_bench: [],
  cpu: ["board_bench"],
  ram_2: ["board_bench"],
  ram_4: ["board_bench"],
  ram_1: ["board_bench"],
  ram_3: ["board_bench"],
  nvme: ["board_bench"],
  board_case: ["board_bench"],
  cooler: ["board_case"],
  fan_front: [],
  fan_rear: [],
  // The card covers the M.2 slot, so the drive goes in first (the rule's "NVMe before the card").
  gpu: ["board_case", "nvme"],
  ssd_sata: [],
  cables: ["board_case"],
  ...Object.fromEntries(place.filter(isPanel).map((p) => [p.id, place.filter((s) => !isPanel(s) && !s.optional).map((s) => s.id)])),
};

/** Steps still to do before `step` in Free mode. A tower cooler overhangs the memory slots, so the memory goes in first. */
export function freeMissing(steps: AssemblyStep[], placed: ReadonlySet<string>, step: AssemblyStep, picks: Picks = defaultPickIds): string[] {
  const needs = [...(FREE_NEEDS[step.id] ?? step.after)];
  if (step.id === "cooler" && getItem(picks.cooler).spec.type !== "aio") {
    for (const s of steps) if (s.kind === "place" && !s.optional && (s.partId === "ram_2" || s.partId === "ram_4")) needs.push(s.id);
  }
  return needs.filter((id) => !placed.has(id));
}

const access = rules.find((r) => r.id === "access_order");

/**
 * What the access-order rule says about placing `candidate` after the parts in `placedParts` (part
 * ids, in the order they went in): a blocking sentence, and a warning that this placement newly causes.
 */
export function freeCheck(picks: Picks, placedParts: readonly string[], candidate: string): { block: string | null; warn: string | null } {
  if (!access) return { block: null, warn: null };
  const before = [...new Set(placedParts)];
  const after = before.includes(candidate) ? before : [...before, candidate];
  const run = (placed: string[]) => access.check({ ...buildFor(picks), placed });
  const now = run(after);
  if (now.ok) return { block: null, warn: null };
  if (now.severity === "block") return { block: now.reason, warn: null };
  const was = run(before);
  return { block: null, warn: !was.ok && was.reason === now.reason ? null : now.reason };
}

/** The message for a placement refused because something has to go in first. */
export const freeMissingMessage = (stepId: string, missing: string[]) => wrongOrderMessage(stepId, missing);
