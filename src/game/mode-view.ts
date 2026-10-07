/**
 * What the /build page shows and allows in each game mode, read from src/data/modes.ts. Pure: the
 * DOM and the machine both use it, so a mode's flags are read in one place.
 */
import { modes, tiers, type Fault, type ModeDef, type ModeId, type TierDef, type TierId } from "@/data/modes";
import { FAULT_COUNT } from "./faults";

/** The order the mode picker lists them in. */
export const BUILD_MODES: ModeId[] = ["guided", "free", "brief", "wontBoot", "speedrun"];

const TIER_ORDER: TierId[] = ["easy", "normal", "hard", "expert"];

/** The mode's tier nearest the one asked for (the easier one on a tie): Speedrun has no Easy, Free no Hard. */
export function clampTier(mode: ModeId, tier: TierId): TierId {
  const offered = modes[mode].tiers;
  if (offered.includes(tier)) return tier;
  const at = TIER_ORDER.indexOf(tier);
  return [...offered].sort((a, b) => Math.abs(TIER_ORDER.indexOf(a) - at) - Math.abs(TIER_ORDER.indexOf(b) - at) || TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b))[0];
}

/**
 * What a tier means in a mode. The tier blurbs in modes.ts describe the guided build (glowing slots, a
 * locked order, time lost to mistakes); Free has no locked order and no clock, and in Won't boot the
 * tier sets the faults and the clues, so those two say what is true there.
 */
const TIER_BLURB: Partial<Record<ModeId, Partial<Record<TierId, string>>>> = {
  free: {
    easy: "Every slot that can take a part glows. A refused part says why.",
    normal: "Only the slot for the part you pick lights up. A refused part says why.",
  },
  wontBoot: {
    easy: `${FAULT_COUNT.easy} fault, with the full report: the symptom, the beeps and what they mean.`,
    normal: `${FAULT_COUNT.normal} faults. The report gives the symptom and the beep code.`,
    hard: `${FAULT_COUNT.hard} faults, and only the beep code to go on.`,
    expert: `${FAULT_COUNT.expert} faults, and only the beep code to go on.`,
  },
};

/** The sentence under the difficulty picker for a mode and tier. */
export function tierBlurb(mode: ModeId, tier: TierId): string {
  return TIER_BLURB[mode]?.[tier] ?? tiers[tier].blurb;
}

export interface ModeView {
  mode: ModeDef;
  /** The tier in use, clamped to one the mode offers. */
  tier: TierDef;
  tiers: TierId[];
  /** Par in seconds for this mode and tier, or null when the mode has no par. */
  parSeconds: number | null;
  showTimer: boolean;
  scored: boolean;
  showBudget: boolean;
  /** The sheet's rows can be swapped for another part of their kind (the player chooses the parts). */
  canSwap: boolean;
}

export function modeView(id: ModeId, tierId: TierId): ModeView {
  const mode = modes[id];
  const tier = tiers[clampTier(id, tierId)];
  return {
    mode,
    tier,
    tiers: mode.tiers,
    parSeconds: mode.parSeconds === null ? null : Math.round(mode.parSeconds * tier.parMultiplier),
    showTimer: mode.timer,
    scored: mode.scored,
    showBudget: mode.budget,
    canSwap: !mode.fixedParts,
  };
}

/** A beep code (S short, L long, empty = silence) in words. */
export function beepWords(code: string): string {
  if (code === "") return "no beeps";
  return [...code].map((c) => (c === "L" ? "long" : "short")).join(", ");
}

/** What a Won't boot fault tells the player at a tier (modes.ts `faultHints`): the symptom, the beep code, and what the code means. */
export function faultClues(fault: Fault, tier: TierId): string[] {
  const hints = tiers[tier].faultHints;
  const beeps = fault.beepCode === "" ? "No beeps at all." : `Beeps: ${beepWords(fault.beepCode)}.`;
  // A silent machine's symptom already says so: do not say it twice.
  const silent = fault.beepCode === "";
  if (hints === "full") return silent ? [fault.symptom, fault.beepHint] : [fault.symptom, beeps, fault.beepHint];
  if (hints === "symptom") return silent ? [fault.symptom] : [fault.symptom, beeps];
  return [beeps];
}
