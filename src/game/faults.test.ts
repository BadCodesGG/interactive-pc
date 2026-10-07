import { describe, expect, it } from "vitest";
import { faults, faultsForTier, type TierId } from "@/data/modes";
import { FAULT_COUNT, REMEDY, faultOnPart, pickFaults } from "./faults";

const TIERS: TierId[] = ["easy", "normal", "hard", "expert"];

describe("the remedy table", () => {
  it("covers every fault in modes.ts and nothing else", () => {
    expect(Object.keys(REMEDY).sort()).toEqual(Object.keys(faults).sort());
  });

  it("says the wrong memory generation has to be swapped, and everything else reseated", () => {
    expect(REMEDY.wrong_ram_gen).toBe("swap");
    for (const [id, how] of Object.entries(REMEDY)) if (id !== "wrong_ram_gen") expect(how, id).toBe("reseat");
  });
});

describe("pickFaults", () => {
  it("gives 1, 2, 2 and 3 faults by tier, at most three", () => {
    expect(FAULT_COUNT).toEqual({ easy: 1, normal: 2, hard: 2, expert: 3 });
    for (const tier of TIERS) expect(pickFaults(tier, 7)).toHaveLength(FAULT_COUNT[tier]);
  });

  it("only picks faults the tier allows, so Easy never gets a Hard fault", () => {
    for (const tier of TIERS) {
      const allowed = faultsForTier(tier).map((f) => f.id);
      for (let seed = 0; seed < 200; seed++) for (const id of pickFaults(tier, seed)) expect(allowed).toContain(id);
    }
  });

  it("never gives two faults on the same part, so one fix means one fault", () => {
    for (const tier of TIERS) {
      for (let seed = 0; seed < 300; seed++) {
        const parts = pickFaults(tier, seed).map((id) => faults[id].fixPartId);
        expect(new Set(parts).size, `${tier} seed ${seed}`).toBe(parts.length);
      }
    }
  });

  it("is the same for the same seed, and varies across seeds", () => {
    expect(pickFaults("expert", 42)).toEqual(pickFaults("expert", 42));
    const seen = new Set<string>();
    for (let seed = 0; seed < 50; seed++) seen.add(pickFaults("normal", seed).join());
    expect(seen.size).toBeGreaterThan(3);
  });

  it("copes with any seed, negative, fractional or huge, without throwing", () => {
    for (const seed of [-1, 0.5, 2 ** 40, Number.MAX_SAFE_INTEGER, NaN]) expect(pickFaults("hard", seed)).toHaveLength(2);
  });
});

describe("faultOnPart", () => {
  it("finds the active fault whose fix is on that part", () => {
    expect(faultOnPart(["half_seated_ram", "missing_paste"], "ram_2")?.id).toBe("half_seated_ram");
    expect(faultOnPart(["half_seated_ram", "missing_paste"], "cooler")?.id).toBe("missing_paste");
  });

  it("finds nothing on a healthy part, a fixed fault's part or an unknown id", () => {
    expect(faultOnPart(["half_seated_ram"], "gpu")).toBeUndefined();
    expect(faultOnPart([], "ram_2")).toBeUndefined();
    expect(faultOnPart(["half_seated_ram"], "toString")).toBeUndefined();
  });
});
