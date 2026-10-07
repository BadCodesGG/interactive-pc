/**
 * The local best score per tier, in localStorage under `blowout-pc-best`. Storage can throw
 * (private mode, a full quota, a blocked origin): every access is wrapped, and a failure means
 * "no best", never a broken game.
 */
import type { ModeId, TierId } from "@/data/modes";

export interface Best {
  stars: number;
  seconds: number;
}

/** A best is kept per tier, and per mode for every mode but Guided (whose keys are the bare tier names, as they always were). */
export type BestKey = TierId | `${Exclude<ModeId, "guided">}:${TierId}`;
export const bestKey = (mode: ModeId, tier: TierId): BestKey => (mode === "guided" ? tier : `${mode}:${tier}`);

type Store = Pick<Storage, "getItem" | "setItem">;

// The key keeps its original name (blowout-pc-best) so saved bests carry over from before the rename.
export const BEST_KEY = "blowout-pc-best";

/** More stars wins; equal stars, the quicker build wins. */
export function betterScore(next: Best, prev: Best | undefined): boolean {
  if (!prev) return true;
  return next.stars > prev.stars || (next.stars === prev.stars && next.seconds < prev.seconds);
}

const storage = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** Parses the stored JSON; anything unreadable is "no best". */
export function parseBest(raw: string | null | undefined): Partial<Record<BestKey, Best>> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Partial<Record<BestKey, Best>>) : {};
  } catch {
    return {};
  }
}

/** The raw stored string: a stable snapshot for useSyncExternalStore. */
export function bestSnapshot(store: Store | null = storage()): string | null {
  try {
    return store?.getItem(BEST_KEY) ?? null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** Called after every saved best, so a subscribed component re-reads it. */
export function subscribeBest(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function readBest(store: Store | null = storage()): Partial<Record<BestKey, Best>> {
  return parseBest(bestSnapshot(store));
}

/** Saves `next` if it beats the stored best for the tier. Returns whether it was a new best and saved. */
export function writeBest(tier: BestKey, next: Best, store: Store | null = storage()): boolean {
  try {
    const all = readBest(store);
    if (!betterScore(next, all[tier])) return false;
    if (!store) return false;
    store.setItem(BEST_KEY, JSON.stringify({ ...all, [tier]: next }));
    listeners.forEach((fn) => fn());
    return true;
  } catch {
    return false;
  }
}
