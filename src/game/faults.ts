/**
 * Won't boot: which faults a round gets, and what fixes each. Pure, and seeded, so a round can be
 * replayed and tested. The faults themselves (symptom, beep code, the part to fix) are in
 * src/data/modes.ts.
 */
import { faults, faultsForTier, type Fault, type TierId } from "@/data/modes";

/** How many faults a round carries: "up to three", more as the tier gets harder. */
export const FAULT_COUNT: Record<TierId, number> = { easy: 1, normal: 2, hard: 2, expert: 3 };

export type Remedy = "reseat" | "swap";

/**
 * What the fix is, as a player's action: press it in, plug it in or refit it (reseat), or replace the
 * part because it is the wrong one (swap). modes.ts has the fix as a sentence; this is its kind.
 */
export const REMEDY: Record<string, Remedy> = {
  half_seated_ram: "reseat",
  missing_eps: "reseat",
  gpu_power_unplugged: "reseat",
  wrong_ram_gen: "swap",
  missing_paste: "reseat",
  blocking_fan: "reseat",
};

/** A small seeded generator (mulberry32). Any number is a valid seed. */
function rng(seed: number): () => number {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fault ids for a round: a seeded shuffle of what the tier allows, at most one per part to fix. */
export function pickFaults(tier: TierId, seed: number): string[] {
  const next = rng(seed);
  const pool = faultsForTier(tier).map((f) => f.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen: string[] = [];
  const used = new Set<string>();
  for (const id of pool) {
    if (chosen.length === FAULT_COUNT[tier]) break;
    if (used.has(faults[id].fixPartId)) continue;
    used.add(faults[id].fixPartId);
    chosen.push(id);
  }
  return chosen;
}

/** The active fault whose fix is on this part. */
export function faultOnPart(active: readonly string[], partId: string): Fault | undefined {
  const id = active.find((x) => Object.hasOwn(faults, x) && faults[x].fixPartId === partId);
  return id === undefined ? undefined : faults[id];
}
