import type { CatalogueItem, CatalogueKind } from "./catalogue";
import { catalogueKinds, totalPrice } from "./catalogue";

export type ModeId = "guided" | "free" | "brief" | "wontBoot" | "speedrun";
export type TierId = "easy" | "normal" | "hard" | "expert";

export interface ModeDef {
  id: ModeId;
  label: string;
  blurb: string;
  /** Tiers the player may pick in this mode. */
  tiers: TierId[];
  /** Which part of the rule set is live. "assembly" = order and fit only; "all" = rules 1 to 11. */
  rules: "assembly" | "all";
  timer: boolean;
  /** Whether a budget is enforced and shown. */
  budget: boolean;
  /** Explanations of each step and part are shown. */
  explanations: boolean;
  /** Player can toggle the exploded view. */
  explodedToggle: boolean;
  /** Spec cards: every stat, or only the spec sheet numbers. */
  specCards: "full" | "sheet";
  /** null = the tier decides; true/false forces it. */
  orderLocked: boolean | null;
  /** The parts are chosen by the game rather than by the player. */
  fixedParts: boolean;
  /** The machine starts assembled, with faults to find. */
  prebuiltFaults: boolean;
  /** Earns stars and a stored best time. */
  scored: boolean;
  /** Par time in seconds at Normal tier; null when there is none. */
  parSeconds: number | null;
}

export const modes: Record<ModeId, ModeDef> = {
  guided: {
    id: "guided",
    label: "Guided build",
    blurb: "Step by step. The slot you need next glows, and every step says why.",
    // The /build game offers Easy, Normal and Hard here: the tier changes the highlights and whether
    // a rejection explains itself. The order stays locked in every tier.
    tiers: ["easy", "normal", "hard"],
    rules: "assembly",
    timer: true,
    budget: false,
    explanations: true,
    explodedToggle: true,
    specCards: "full",
    orderLocked: true,
    fixedParts: true,
    prebuiltFaults: false,
    scored: true,
    parSeconds: 300,
  },
  free: {
    id: "free",
    label: "Free build",
    blurb: "A sandbox. Pick up anything, explode the view, and read every spec card.",
    tiers: ["easy", "normal"],
    rules: "all",
    timer: false,
    budget: false,
    explanations: true,
    explodedToggle: true,
    specCards: "full",
    orderLocked: false,
    fixedParts: false,
    prebuiltFaults: false,
    scored: false,
    parSeconds: null,
  },
  brief: {
    id: "brief",
    label: "Brief",
    blurb: "A client wants a PC for a job and a budget. Shop for parts, then build it. All the rules are live.",
    tiers: ["easy", "normal", "hard", "expert"],
    rules: "all",
    timer: true,
    budget: true,
    explanations: false,
    explodedToggle: true,
    specCards: "sheet",
    orderLocked: null,
    fixedParts: false,
    prebuiltFaults: false,
    scored: true,
    parSeconds: 600,
  },
  wontBoot: {
    id: "wontBoot",
    label: "Won't boot",
    blurb: "A finished PC that will not start. Open the case, inspect it, fix up to three faults and press power.",
    tiers: ["easy", "normal", "hard", "expert"],
    rules: "all",
    timer: true,
    budget: false,
    explanations: false,
    // Inspection is through the open case (X-ray), not the explode slider.
    explodedToggle: false,
    specCards: "sheet",
    orderLocked: false,
    fixedParts: true,
    prebuiltFaults: true,
    scored: true,
    parSeconds: 180,
  },
  speedrun: {
    id: "speedrun",
    label: "Speedrun",
    blurb: "Fixed parts and a clock. Build the machine as fast as you can without a single wrong move.",
    tiers: ["normal", "hard", "expert"],
    rules: "assembly",
    timer: true,
    budget: false,
    explanations: false,
    explodedToggle: false,
    specCards: "sheet",
    orderLocked: false,
    fixedParts: true,
    prebuiltFaults: false,
    scored: true,
    parSeconds: 240,
  },
};

export interface TierDef {
  id: TierId;
  label: string;
  blurb: string;
  /** Which slots glow: every valid one, only while dragging, or never. */
  highlights: "all-valid" | "while-dragging" | "none";
  /** Placing a part out of order is refused outright. */
  orderLocked: boolean;
  /** A rejection explains itself with the rule's reason. */
  reasonsShown: boolean;
  /** Rule ids that are not shown on the spec sheet or before a drop. They still apply. */
  hiddenRuleIds: string[];
  /** Hidden rules are revealed here: when the placement is rejected, or only at power on. */
  hiddenRuleReveal: "never" | "on-reject" | "power-on";
  /** How mistakes are punished. "none" ignores them; "time" adds seconds; "stars" counts them for the star; "full" does both. */
  mistakePenalty: "none" | "time" | "stars" | "full";
  /** Seconds added per mistake when the penalty includes time. */
  timePenaltySeconds: number;
  /** The Brief budget is enforced (a build over budget cannot earn the budget star). */
  budgetEnforced: boolean;
  /** A fault is injected part way through the build. */
  midBuildFault: boolean;
  /** How much of the Won't boot hint is given: everything, the beep code plus a symptom, or the beep code only. */
  faultHints: "full" | "symptom" | "beep-only";
  /** Multiplies the mode's par time. */
  parMultiplier: number;
}

export const tiers: Record<TierId, TierDef> = {
  easy: {
    id: "easy",
    label: "Easy",
    blurb: "Every valid slot glows and the order is locked. Nothing is held against you.",
    highlights: "all-valid",
    orderLocked: true,
    reasonsShown: true,
    hiddenRuleIds: [],
    hiddenRuleReveal: "never",
    mistakePenalty: "none",
    timePenaltySeconds: 0,
    budgetEnforced: false,
    midBuildFault: false,
    faultHints: "full",
    parMultiplier: 1.5,
  },
  normal: {
    id: "normal",
    label: "Normal",
    blurb: "Only the slot for the part you pick lights up. A rejected part says why. Mistakes cost time.",
    highlights: "while-dragging",
    orderLocked: false,
    reasonsShown: true,
    hiddenRuleIds: [],
    hiddenRuleReveal: "never",
    mistakePenalty: "time",
    timePenaltySeconds: 10,
    budgetEnforced: true,
    midBuildFault: false,
    faultHints: "symptom",
    parMultiplier: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    blurb: "No highlights, only the spec sheet. One rule is hidden until it bites, and mistakes cost stars.",
    highlights: "none",
    orderLocked: false,
    reasonsShown: false,
    hiddenRuleIds: ["ram_tower_clearance"],
    hiddenRuleReveal: "power-on",
    mistakePenalty: "stars",
    timePenaltySeconds: 0,
    budgetEnforced: true,
    midBuildFault: false,
    faultHints: "beep-only",
    parMultiplier: 0.85,
  },
  expert: {
    id: "expert",
    label: "Expert",
    blurb: "Hard, plus a fault slips in mid-build. Mistakes cost time and stars.",
    highlights: "none",
    orderLocked: false,
    reasonsShown: false,
    hiddenRuleIds: ["ram_tower_clearance"],
    hiddenRuleReveal: "power-on",
    mistakePenalty: "full",
    timePenaltySeconds: 15,
    budgetEnforced: true,
    midBuildFault: true,
    faultHints: "beep-only",
    parMultiplier: 0.75,
  },
};

/**
 * Turns the raw clock and the raw mistake count into the numbers the scorer sees for a tier.
 * Easy ignores mistakes; Normal turns them into time; Hard counts them for the star;
 * Expert does both.
 */
export function applyTierPenalties(
  tier: TierId,
  seconds: number,
  mistakes: number,
): { seconds: number; mistakes: number } {
  const t = tiers[tier];
  const addsTime = t.mistakePenalty === "time" || t.mistakePenalty === "full";
  const countsMistakes = t.mistakePenalty === "stars" || t.mistakePenalty === "full";
  return {
    seconds: seconds + (addsTime ? mistakes * t.timePenaltySeconds : 0),
    mistakes: countsMistakes ? mistakes : 0,
  };
}

export type BeepPattern = string; // "S" short, "L" long, "" silence

export interface Fault {
  id: string;
  label: string;
  /** What is actually wrong, shown when the player fixes it. */
  description: string;
  /** What the player sees and hears before opening the case. */
  symptom: string;
  /** This game's own beep code (short = S, long = L). Not a real BIOS table. */
  beepCode: BeepPattern;
  /** Plain-language reading of the beep code, shown at lower tiers. */
  beepHint: string;
  /** The part to inspect and fix. */
  fixPartId: string;
  /** What the fix is. */
  fix: string;
  /** Fault appears at this tier and above. */
  minTier: TierId;
  /** Slot the fault lives in, when it is slot-specific. */
  slotId?: string;
}

export const faults: Record<string, Fault> = {
  half_seated_ram: {
    id: "half_seated_ram",
    label: "Half-seated memory",
    description: "One memory stick was not pushed in until the clips clicked, so the board cannot read it.",
    symptom: "Fans spin, no picture, and the machine beeps three times, then repeats.",
    beepCode: "SSS",
    beepHint: "Three short beeps: a memory module is not seated.",
    fixPartId: "ram_2",
    slotId: "slot_ram_2",
    fix: "Press the stick in firmly until both clips click.",
    minTier: "easy",
  },
  missing_eps: {
    id: "missing_eps",
    label: "CPU power lead missing",
    description: "The 8-pin CPU power lead was never plugged in, so the CPU gets no power.",
    symptom: "The fans twitch for a moment and stop. No beeps at all.",
    beepCode: "",
    beepHint: "Silence: the board is not getting power to the CPU.",
    fixPartId: "cables",
    slotId: "slot_cables",
    fix: "Plug the 8-pin CPU lead into the socket at the top corner of the board.",
    minTier: "easy",
  },
  gpu_power_unplugged: {
    id: "gpu_power_unplugged",
    label: "Graphics power unplugged",
    description: "The graphics card's PCIe power lead is not plugged in, so the card cannot start.",
    symptom: "The machine seems to start and then the screen stays black. The card's fans run at full speed.",
    beepCode: "LSS",
    beepHint: "One long, two short: a graphics fault.",
    fixPartId: "cables",
    slotId: "slot_cables",
    fix: "Plug the PCIe lead into the graphics card.",
    minTier: "easy",
  },
  wrong_ram_gen: {
    id: "wrong_ram_gen",
    label: "Wrong memory generation",
    description: "The memory is the wrong generation for this board. Someone forced it in, and the board cannot use it.",
    symptom: "Fans spin, no picture, and the machine beeps four times, then repeats.",
    beepCode: "SSSS",
    beepHint: "Four short beeps: memory is present but not recognised.",
    fixPartId: "ram_1",
    slotId: "slot_ram_1",
    fix: "Replace the memory with the generation the board takes.",
    minTier: "normal",
  },
  missing_paste: {
    id: "missing_paste",
    label: "No thermal paste",
    description: "The cooler was fitted with no thermal paste, so the CPU cannot pass its heat on.",
    symptom: "The machine starts, then shuts down within seconds. The CPU temperature shoots up on the boot screen.",
    beepCode: "SLSL",
    beepHint: "Short, long, short, long: the CPU is overheating.",
    fixPartId: "cooler",
    slotId: "slot_cooler",
    fix: "Lift the cooler, add a pea-sized dot of paste and refit the cooler.",
    minTier: "normal",
  },
  blocking_fan: {
    id: "blocking_fan",
    label: "Fan blocked",
    description: "A loose cable is touching the front fan's blades, so the fan cannot spin up.",
    symptom: "The machine boots but the front fan does not spin. The boot screen reports a fan fault and the case heats up.",
    beepCode: "LL",
    beepHint: "Two long beeps: a fan is not spinning.",
    fixPartId: "fan_front",
    slotId: "slot_fan_front",
    fix: "Move the loose cable clear of the blades so the fan can spin.",
    minTier: "hard",
  },
};

/** Faults that may appear at a tier, in a stable order. */
export function faultsForTier(tier: TierId): Fault[] {
  const order: TierId[] = ["easy", "normal", "hard", "expert"];
  return Object.values(faults).filter((fault) => order.indexOf(fault.minTier) <= order.indexOf(tier));
}

export interface BriefRequirements {
  minCores: number;
  minGpuTdpW: number;
  minRamGb: number;
  minStorageGb: number;
  /** Case must accept this board size or smaller (undefined = any). */
  maxBoardSize?: "ATX" | "mATX" | "ITX";
}

export interface Brief {
  id: string;
  title: string;
  blurb: string;
  budgetUsd: number;
  parSeconds: number;
  requirements: BriefRequirements;
}

export const briefs: Brief[] = [
  {
    id: "streaming",
    title: "Streaming PC",
    blurb: "Build a streaming PC under $1,200. It needs to play a game and encode video at the same time.",
    budgetUsd: 1200,
    parSeconds: 600,
    requirements: { minCores: 8, minGpuTdpW: 150, minRamGb: 32, minStorageGb: 1000 },
  },
  {
    id: "shoebox",
    title: "Living room shoebox",
    blurb: "A small, quiet console-sized PC under $1,300 that fits on the shelf under the TV.",
    budgetUsd: 1300,
    parSeconds: 600,
    requirements: { minCores: 8, minGpuTdpW: 150, minRamGb: 32, minStorageGb: 1000, maxBoardSize: "ITX" },
  },
  {
    id: "workhorse",
    title: "Editing workhorse",
    blurb: "A video editor needs 12 cores, 64 GB of memory and 4 TB of storage for $2,400 or less.",
    budgetUsd: 2400,
    parSeconds: 720,
    requirements: { minCores: 12, minGpuTdpW: 200, minRamGb: 64, minStorageGb: 4000 },
  },
];

const BOARD_ORDER = ["ITX", "mATX", "ATX"];

/** Which requirements a chosen set of parts fails, plus the price against the budget. */
export function evaluateBrief(
  brief: Brief,
  items: Partial<Record<CatalogueKind, CatalogueItem>>,
): { failures: string[]; spentUsd: number; withinBudget: boolean } {
  const failures: string[] = [];
  const req = brief.requirements;
  const num = (item: CatalogueItem | undefined, key: string): number => {
    const v = item?.spec[key];
    return typeof v === "number" ? v : 0;
  };
  if (num(items.cpu, "cores") < req.minCores) failures.push(`Needs at least ${req.minCores} CPU cores.`);
  if (num(items.gpu, "tdpW") < req.minGpuTdpW) failures.push("The graphics card is too weak for this job.");
  if (num(items.ram, "gb") < req.minRamGb) failures.push(`Needs at least ${req.minRamGb} GB of memory.`);
  const storage = num(items.nvme, "gb") + num(items.ssd, "gb");
  if (storage < req.minStorageGb) failures.push(`Needs at least ${req.minStorageGb} GB of storage.`);
  if (req.maxBoardSize) {
    const board = items.motherboard?.spec.formFactor;
    if (typeof board !== "string" || BOARD_ORDER.indexOf(board) > BOARD_ORDER.indexOf(req.maxBoardSize)) {
      failures.push(`The build must use a ${req.maxBoardSize} board or smaller.`);
    }
  }
  const chosen = catalogueKinds.map((kind) => items[kind]).filter((item): item is CatalogueItem => item !== undefined);
  const spentUsd = totalPrice(chosen);
  return { failures, spentUsd, withinBudget: spentUsd <= brief.budgetUsd };
}
