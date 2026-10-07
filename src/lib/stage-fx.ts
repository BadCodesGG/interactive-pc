"use client";

/**
 * Two switches that the page's DOM and the stage share without the stage's code: the heat overlay and
 * the machine's power. A tiny store outside React (like the engine's), so a button in a server page's
 * controls row, the legend over the stage and the lazy canvas layer all read the same value.
 */
import { useSyncExternalStore } from "react";

export interface StageFxState {
  heat: boolean;
  power: boolean;
}

export function createStageFx() {
  let state: StageFxState = { heat: false, power: false };
  const listeners = new Set<() => void>();
  const set = (next: StageFxState) => {
    if (next.heat === state.heat && next.power === state.power) return;
    state = next;
    listeners.forEach((fn) => fn());
  };
  return {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setHeat: (heat: boolean) => set({ ...state, heat }),
    setPower: (power: boolean) => set({ ...state, power }),
    reset: () => set({ heat: false, power: false }),
  };
}

export type StageFx = ReturnType<typeof createStageFx>;

/** The one store every stage on a page shares. */
export const stageFx = createStageFx();

export function useStageFx(): StageFxState {
  return useSyncExternalStore(stageFx.subscribe, stageFx.getState, stageFx.getState);
}
