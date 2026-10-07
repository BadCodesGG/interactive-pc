"use client";

/**
 * The build game's live state: the pure machine behind a tiny subscribe/getState store, so the DOM
 * (tray list, buttons, aria-live) and the canvas layer read the same state and call the same
 * actions. React reads it with useSyncExternalStore; the canvas subscribes directly.
 */
import { useSyncExternalStore } from "react";
import { modes, tiers, type ModeId, type TierId } from "@/data/modes";
import type { Picks } from "@/data/compat";
import type { Remedy } from "./faults";
import * as M from "./machine";
import { clampTier } from "./mode-view";

export interface GameStore {
  getState(): M.GameState;
  subscribe(fn: () => void): () => void;
  select(partId: string | null): void;
  /** Places a part in a slot; every input path ends here. */
  place(partId: string, slotId: string): M.PlaceResult;
  /** Places the selected part in its own slot: the keyboard path and the Easy tier's "anywhere on the case". */
  placeSelected(): M.PlaceResult | null;
  applySubStep(subId: string): void;
  hint(): void;
  /** Picks up the part the active step needs. */
  nextStep(): void;
  powerOn(): M.PlaceResult;
  reset(): void;
  /** Won't boot: look closely at the selected part. */
  inspect(): void;
  /** Won't boot: reseat or swap the selected part. */
  fix(how: Remedy): M.PlaceResult | null;
  /** The sheet's parts changed (Free reads them for the rules). */
  setPicks(picks: Picks): void;
  setTier(tier: TierId): void;
  /** Switches mode and starts the build again, keeping the tier when the mode offers it and the nearest one otherwise. */
  setMode(mode: ModeId): void;
  /** Says something through the aria-live region without changing the build. */
  say(message: string): void;
}

/** What the aria-live line says on entering a mode that is not just "the build starts again". */
const MODE_MESSAGE: Partial<Record<ModeId, string>> = {
  free: "Free build. Pick any part from the tray and place it.",
  wontBoot: "A machine that will not boot. Read the symptoms, then find the fault.",
};

/** A fresh round's seed. Only ever called from a player's action, never while rendering, so the server and the client agree. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

export function createGameStore({
  tier = "normal",
  mode = "guided",
  picks,
  now = Date.now,
  seed = freshSeed,
}: { tier?: TierId; mode?: ModeId; picks?: Picks; now?: () => number; seed?: () => number } = {}): GameStore {
  let state = M.createGame({ tier, mode, picks });
  const listeners = new Set<() => void>();
  const set = (next: M.GameState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((fn) => fn());
  };
  const place = (partId: string, slotId: string) => {
    const r = M.place(state, partId, slotId, now());
    set(r.state);
    return r.result;
  };
  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    select: (partId) => set(M.select(state, partId, now())),
    place,
    placeSelected() {
      const part = state.selectedPart;
      const step = part ? M.pendingStepFor(state, part) : undefined;
      return part && step ? place(part, step.slotId) : null;
    },
    applySubStep: (subId) => set(M.applySubStep(state, subId, now())),
    hint: () => set(M.hint(state).state),
    nextStep() {
      const step = state.steps.find((s) => s.id === state.activeStep);
      if (step?.kind === "place") set(M.select(state, step.partId, now()));
    },
    powerOn() {
      const r = M.powerOn(state, now());
      set(r.state);
      return r.result;
    },
    reset: () =>
      set({
        ...M.reset(state, state.mode === "wontBoot" ? seed() : state.seed),
        message: state.mode === "wontBoot" ? "A new machine that will not boot." : "The build has been reset. Every part is back in the tray.",
      }),
    inspect() {
      if (state.selectedPart) set(M.inspect(state, state.selectedPart, now()));
    },
    fix(how) {
      if (!state.selectedPart) return null;
      const r = M.fix(state, state.selectedPart, how, now());
      set(r.state);
      return r.result;
    },
    setPicks: (picks) => set(M.withPicks(state, picks)),
    setTier(tier) {
      if (tier === state.tier) return;
      // "Starts again" is only true of a build that has started: before the first move nothing is lost.
      const message = state.startedAt === null ? `Difficulty set to ${tiers[tier].label}.` : `Difficulty set to ${tiers[tier].label}. The build starts again.`;
      set({ ...M.createGame({ tier, steps: state.steps, mode: state.mode, picks: state.picks, seed: seed() }), message });
    },
    setMode(mode) {
      if (mode === state.mode) return;
      // A mode with no line of its own falls back to the page's start prompt, unless a build is under way to be lost.
      const message = MODE_MESSAGE[mode] ?? (state.startedAt === null ? null : `${modes[mode].label}. The build starts again.`);
      set({ ...M.createGame({ tier: clampTier(mode, state.tier), steps: state.steps, mode, picks: state.picks, seed: seed() }), message });
    },
    say: (message) => set({ ...state, message }),
  };
}

export function useGame(store: GameStore): M.GameState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
