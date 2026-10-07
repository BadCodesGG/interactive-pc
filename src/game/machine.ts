/**
 * The build game as a pure state machine. Every input path (click then click, drag and drop, the
 * keyboard tray) ends in `place`, so the rules live in exactly one place and the scene only draws
 * what the state says.
 *
 * Steps come from src/data/assembly.ts. A step is done once it is in `placed`; a step is valid when
 * every step in its `after` list is done. The order is locked in every tier of the Guided mode: an
 * early placement is refused and counted as a mistake. The tier decides only whether the refusal
 * explains itself (modes.ts `reasonsShown`) and, in the scene, which slots glow.
 *
 * Functions never mutate their input. Times are passed in (milliseconds), so tests need no clock.
 */
import { assemblySteps, wrongOrderMessage, wrongPlacementMessages, type AssemblyStep } from "@/data/assembly";
import type { Picks } from "@/data/compat";
import { applyTierPenalties, faults, modes, tiers, type ModeId, type TierId } from "@/data/modes";
import { pcSidecar } from "@/data/pc";
import { scoreBuild, type ScoreResult } from "@/data/scoring";
import { defaultPickIds } from "@/data/showcase";
import { REMEDY, faultOnPart, pickFaults, type Remedy } from "./faults";
import { freeCheck, freeMissing } from "./free-rules";
import { faultClues } from "./mode-view";

export type PlaceResult = { ok: true } | { ok: false; reason: string };

export interface GameEvent {
  /** `noboot`: the power button was pressed on a machine that still has a fault (Won't boot). `fixed`: a fault was put right (Won't boot); nothing moved. */
  kind: "placed" | "rejected" | "powered" | "noboot" | "fixed";
  partId: string;
  slotId: string;
  /** Increments on every event, so a subscriber can tell two identical events apart. */
  seq: number;
  /** `rejected`: what the refusal said. */
  reason?: string;
}

export interface GameState {
  steps: AssemblyStep[];
  tier: TierId;
  /** Sets the par and whether a finished build is scored (src/data/modes.ts). The assembly rules are the same in every mode. */
  mode: ModeId;
  /** The parts on the sheet: Free mode reads the cooler's type from them (a tower blocks the memory, a radiator does not). */
  picks: Picks;
  /** Won't boot: the faults still in the machine, and the ones fixed, by id in src/data/modes.ts. */
  faults: readonly string[];
  fixed: readonly string[];
  /** Picks this round's faults; a reset moves to the next one. */
  seed: number;
  /** Ids of the steps that are done. */
  placed: ReadonlySet<string>;
  /** Ids of the sub-steps that are done (the thermal paste). */
  subDone: ReadonlySet<string>;
  selectedPart: string | null;
  /** The first valid step in the recommended order: what the Normal tier highlights. */
  activeStep: string | null;
  mistakes: number;
  hintsUsed: number;
  startedAt: number | null;
  finishedAt: number | null;
  /** The last thing the game said: read out by the aria-live region. */
  message: string | null;
  last: GameEvent | null;
}

/** Shown on Hard, where a refusal does not say which rule it broke. */
export const HIDDEN_REASON = "That part cannot go in yet.";
const ALREADY_IN = "That part is already in.";
const FINISHED = "The build is finished. Press Reset to build it again.";
const BUILT = "The machine is already built. Find what is wrong with it.";
/** Sub-steps with a dedicated wrong-placement message. */
const SUB_STEP_MESSAGES: Record<string, string> = { paste: wrongPlacementMessages.cooler_no_paste };

function derive(s: Omit<GameState, "activeStep">): GameState {
  const active = s.steps.find((step) => !s.placed.has(step.id) && step.after.every((id) => s.placed.has(id)));
  return { ...s, activeStep: active?.id ?? null };
}

export function createGame({
  tier = "normal",
  steps = assemblySteps,
  mode = "guided",
  picks = defaultPickIds,
  seed = 1,
}: { tier?: TierId; steps?: AssemblyStep[]; mode?: ModeId; picks?: Picks; seed?: number } = {}): GameState {
  // Won't boot arrives built: every part is in, and something is wrong.
  const prebuilt = modes[mode].prebuiltFaults;
  return derive({
    steps,
    tier,
    mode,
    picks,
    seed,
    faults: prebuilt ? pickFaults(tier, seed) : [],
    fixed: [],
    placed: new Set(prebuilt ? steps.filter((x) => x.kind === "place").map((x) => x.id) : []),
    subDone: new Set(),
    selectedPart: null,
    mistakes: 0,
    hintsUsed: 0,
    startedAt: null,
    finishedAt: null,
    message: null,
    last: null,
  });
}

/**
 * The steps still to do before this one. The guided modes follow the recommended order; Free keeps
 * only what is physically necessary (src/game/free-rules.ts).
 */
export function missingFor(s: GameState, step: AssemblyStep): string[] {
  return s.mode === "free" ? freeMissing(s.steps, s.placed, step, s.picks) : step.after.filter((id) => !s.placed.has(id));
}

/** Steps not yet done whose dependencies are all done: what the Easy tier highlights. */
export function validSteps(s: GameState): AssemblyStep[] {
  return s.steps.filter((step) => !s.placed.has(step.id) && missingFor(s, step).length === 0);
}

/** A step that moves a part already placed (the board, bench to case) is only offered once it can be done. */
export function stepReady(s: GameState, step: AssemblyStep): boolean {
  return !step.movesExisting || missingFor(s, step).length === 0;
}

/** The next place step this part still has to make, in step order. */
export function pendingStepFor(s: GameState, partId: string): AssemblyStep | undefined {
  return s.steps.find((step) => step.kind === "place" && step.partId === partId && !s.placed.has(step.id));
}

/**
 * The parts waiting in the tray, in step order. A part that has been placed comes back only for a
 * step that moves it (the motherboard, bench to case), and only once that move is valid.
 */
export function trayParts(s: GameState): string[] {
  const parts = [...new Set(s.steps.filter((step) => step.kind === "place").map((step) => step.partId))];
  return parts.filter((id) => {
    const next = pendingStepFor(s, id);
    return !!next && stepReady(s, next);
  });
}

const partName = (partId: string) => pcSidecar.parts[partId]?.label ?? partId;

/** Parts the player can pick up: the tray's in a build, every part of the machine in Won't boot. */
export function selectable(s: GameState, partId: string): boolean {
  return s.mode === "wontBoot" ? s.steps.some((x) => x.partId === partId) : !!pendingStepFor(s, partId);
}

const start = (s: GameState, now: number) => s.startedAt ?? now;

export function select(s: GameState, partId: string | null, now = 0): GameState {
  if (partId === null) return s.selectedPart === null ? s : { ...s, selectedPart: null };
  if (s.finishedAt !== null || !selectable(s, partId)) return s;
  // Looking at a part is not starting the clock in Won't boot: the round starts at the first move.
  return { ...s, selectedPart: partId, startedAt: s.mode === "wontBoot" ? s.startedAt : start(s, now) };
}

/**
 * The refusal the game is still showing, or null once it has said something else. A refusal is the
 * message the last rejected move set: the next hint, step or note replaces it.
 */
export function refusalOf(s: GameState): string | null {
  return s.last?.kind === "rejected" && s.last.reason !== undefined && s.message === s.last.reason ? s.message : null;
}

/**
 * The step to do before `step` that can be done now. A step can wait on one that itself waits (the CPU
 * on the board, the board on the power supply), and the refusal should name the last of the chain:
 * that is the real next step.
 */
export function nextBlocker(s: GameState, step: AssemblyStep): AssemblyStep | undefined {
  for (const id of missingFor(s, step)) {
    const dep = s.steps.find((x) => x.id === id);
    if (dep) return nextBlocker(s, dep) ?? dep;
  }
  return undefined;
}

/** The wrong-order sentence for `step`: its own reason, then the one step to do first. */
function orderMessage(s: GameState, step: AssemblyStep): string {
  const first = nextBlocker(s, step);
  return wrongOrderMessage(step.id, first ? [first.id] : []);
}

function reject(s: GameState, partId: string, slotId: string, reason: string, now: number): { state: GameState; result: PlaceResult } {
  const seq = (s.last?.seq ?? 0) + 1;
  return {
    state: { ...s, mistakes: s.mistakes + 1, message: reason, startedAt: start(s, now), last: { kind: "rejected", partId, slotId, seq, reason } },
    result: { ok: false, reason },
  };
}

export function place(s: GameState, partId: string, slotId: string, now = 0): { state: GameState; result: PlaceResult } {
  if (s.finishedAt !== null) return { state: { ...s, message: FINISHED }, result: { ok: false, reason: FINISHED } };
  if (s.mode === "wontBoot") return { state: { ...s, message: BUILT }, result: { ok: false, reason: BUILT } };
  const step = pendingStepFor(s, partId);
  if (!step) return { state: { ...s, message: ALREADY_IN }, result: { ok: false, reason: ALREADY_IN } };
  if (step.slotId !== slotId) return reject(s, partId, slotId, wrongPlacementMessages.wrong_slot, now);

  const reasons = tiers[s.tier].reasonsShown;
  if (missingFor(s, step).length) return reject(s, partId, slotId, reasons ? orderMessage(s, step) : HIDDEN_REASON, now);
  // Free build: anything that is physically possible goes in; the rules say what is not, and what is only a squeeze.
  let warn: string | null = null;
  if (s.mode === "free") {
    const placedParts = [...s.placed].map((id) => s.steps.find((x) => x.id === id)?.partId).filter((x): x is string => !!x);
    const check = freeCheck(s.picks, placedParts, step.partId);
    if (check.block) return reject(s, partId, slotId, reasons ? check.block : HIDDEN_REASON, now);
    warn = check.warn;
  }
  const sub = step.subSteps?.find((x) => !s.subDone.has(x.id));
  if (sub) return reject(s, partId, slotId, reasons ? (SUB_STEP_MESSAGES[sub.id] ?? sub.reason) : HIDDEN_REASON, now);

  const placed = new Set(s.placed).add(step.id);
  const seq = (s.last?.seq ?? 0) + 1;
  return {
    state: derive({
      ...s,
      placed,
      selectedPart: null,
      startedAt: start(s, now),
      message: `${step.label}: done. ${placed.size} of ${s.steps.length} steps complete.${warn ? ` ${warn}` : ""}`,
      last: { kind: "placed", partId, slotId, seq },
    }),
    result: { ok: true },
  };
}

/** Marks a sub-step (the thermal paste) done. Only allowed while its parent step is valid. */
export function applySubStep(s: GameState, subId: string, now = 0): GameState {
  const step = validSteps(s).find((x) => x.subSteps?.some((sub) => sub.id === subId));
  if (!step || s.subDone.has(subId)) return s;
  const sub = step.subSteps!.find((x) => x.id === subId)!;
  return { ...s, subDone: new Set(s.subDone).add(subId), startedAt: start(s, now), message: `${sub.label}: done.` };
}

/** The active step's hint (or its pending sub-step's), and a state that says it aloud. */
export function hint(s: GameState): { state: GameState; text: string } {
  // Won't boot: the fullest clue the game has for the first fault still in the machine.
  if (s.mode === "wontBoot" && s.faults.length > 0) {
    const text = faultClues(faults[s.faults[0]], "easy").join(" ");
    return { state: { ...s, hintsUsed: s.hintsUsed + 1, message: text }, text };
  }
  const step = s.steps.find((x) => x.id === s.activeStep);
  if (!step) return { state: s, text: "" };
  const sub = step.subSteps?.find((x) => !s.subDone.has(x.id));
  const text = sub ? sub.hint : step.hint;
  return { state: { ...s, hintsUsed: s.hintsUsed + 1, message: text }, text };
}

export function powerOn(s: GameState, now = 0): { state: GameState; result: PlaceResult } {
  const step = s.steps.find((x) => x.kind === "action");
  if (!step || s.finishedAt !== null) return { state: s, result: { ok: false, reason: FINISHED } };
  if (missingFor(s, step).length) {
    return reject(s, step.partId, step.slotId, tiers[s.tier].reasonsShown ? orderMessage(s, step) : HIDDEN_REASON, now);
  }
  // Won't boot: pressing power on a faulty machine is how the player sees the symptom, so it costs nothing.
  if (s.faults.length > 0) {
    const reason = `It does not boot. ${s.faults.flatMap((id) => faultClues(faults[id], s.tier)).join(" ")}`;
    const seq = (s.last?.seq ?? 0) + 1;
    return {
      state: { ...s, startedAt: start(s, now), message: reason, last: { kind: "noboot", partId: step.partId, slotId: step.slotId, seq } },
      result: { ok: false, reason },
    };
  }
  const seq = (s.last?.seq ?? 0) + 1;
  return {
    state: derive({
      ...s,
      placed: new Set(s.placed).add(step.id),
      selectedPart: null,
      startedAt: start(s, now),
      finishedAt: now,
      message: "Power on. The machine passes its checks and boots.",
      last: { kind: "powered", partId: step.partId, slotId: step.slotId, seq },
    }),
    result: { ok: true },
  };
}

/** Won't boot: look closely at a part. A faulty one gives up what is wrong with it; a healthy one says so. Free of charge. */
export function inspect(s: GameState, partId: string, now = 0): GameState {
  if (s.mode !== "wontBoot" || s.finishedAt !== null || !selectable(s, partId)) return s;
  const fault = faultOnPart(s.faults, partId);
  const message = fault ? `${partName(partId)}: ${fault.description}` : `${partName(partId)}: nothing wrong that you can see.`;
  return { ...s, selectedPart: partId, startedAt: start(s, now), message };
}

/**
 * Won't boot: reseat a part (press it in, plug it in, refit it) or swap it for a new one. Doing the
 * right thing to the faulty part fixes it; the wrong part, or reseating what has to be replaced, is a
 * mistake. A swap fixes a reseat fault too, but it is a mistake: a good part was thrown away.
 */
export function fix(s: GameState, partId: string, how: Remedy, now = 0): { state: GameState; result: PlaceResult } {
  if (s.finishedAt !== null) return { state: { ...s, message: FINISHED }, result: { ok: false, reason: FINISHED } };
  if (s.mode !== "wontBoot" || !selectable(s, partId)) return { state: s, result: { ok: false, reason: "Nothing to fix here." } };
  const fault = faultOnPart(s.faults, partId);
  const slotId = fault?.slotId ?? `slot_${partId}`;
  if (!fault) return reject(s, partId, slotId, `${partName(partId)}: nothing was wrong with it, so that did not help.`, now);
  const needed = REMEDY[fault.id] ?? "reseat";
  if (needed === "swap" && how === "reseat") {
    return reject(s, partId, slotId, `Reseating does not help: ${partName(partId)} has to be replaced. ${fault.description}`, now);
  }
  const wasteful = needed === "reseat" && how === "swap";
  const left = s.faults.filter((id) => id !== fault.id);
  const seq = (s.last?.seq ?? 0) + 1;
  const next = left.length === 0 ? "That was the last fault: press power." : `${left.length} more to find.`;
  return {
    state: {
      ...s,
      faults: left,
      fixed: [...s.fixed, fault.id],
      mistakes: s.mistakes + (wasteful ? 1 : 0),
      startedAt: start(s, now),
      message: `${fault.label}: fixed. ${fault.fix} ${wasteful ? "A new part was not needed: reseating would have done it. " : ""}${next}`,
      last: { kind: "fixed", partId, slotId, seq },
    },
    result: { ok: true },
  };
}

/** A new round: the same mode and tier, and in Won't boot the next set of faults. */
export function reset(s: GameState, seed = s.seed + 1): GameState {
  return createGame({ tier: s.tier, steps: s.steps, mode: s.mode, picks: s.picks, seed });
}

/** The sheet's parts changed: Free reads them for the rules. */
export function withPicks(s: GameState, picks: Picks): GameState {
  return s.picks === picks ? s : { ...s, picks };
}

/** Par for a mode at a tier, in seconds (Guided by default). */
export function parSeconds(tier: TierId, mode: ModeId = "guided"): number {
  return Math.round((modes[mode].parSeconds ?? modes.guided.parSeconds ?? 300) * tiers[tier].parMultiplier);
}

/** Stars for a finished build, with the tier's penalties applied; null until it is finished, and in a mode that is not scored. */
export function scoreGame(s: GameState): ScoreResult | null {
  if (s.finishedAt === null || s.startedAt === null || !modes[s.mode].scored) return null;
  const raw = (s.finishedAt - s.startedAt) / 1000;
  const { seconds, mistakes } = applyTierPenalties(s.tier, raw, s.mistakes);
  return scoreBuild({ seconds, mistakes, parSeconds: parSeconds(s.tier, s.mode) });
}
