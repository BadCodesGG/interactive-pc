import { describe, expect, it } from "vitest";
import { assemblySteps } from "@/data/assembly";
import { faults, tiers, type TierId } from "@/data/modes";
import { FAULT_COUNT, REMEDY } from "./faults";
import { createGame, fix, inspect, parSeconds, place, powerOn, reset, scoreGame, select, trayParts, type GameState } from "./machine";
import { faultClues } from "./mode-view";

const round = (tier: TierId = "normal", seed = 3) => createGame({ mode: "wontBoot", tier, seed });
const activeFaults = (s: GameState) => s.faults.map((id) => faults[id]);

describe("a Won't boot round starts built and faulty", () => {
  it("has every part in and power not yet pressed", () => {
    const s = round();
    expect(s.placed.size).toBe(assemblySteps.filter((x) => x.kind === "place").length);
    expect(s.finishedAt).toBeNull();
    expect(s.activeStep).toBe("power_on");
    expect(trayParts(s)).toEqual([]);
  });

  it("carries the tier's number of faults, each from modes.ts", () => {
    for (const tier of ["easy", "normal", "hard", "expert"] as const) {
      const s = round(tier, 11);
      expect(s.faults).toHaveLength(FAULT_COUNT[tier]);
      for (const id of s.faults) expect(faults[id]).toBeDefined();
      expect(s.fixed).toEqual([]);
    }
  });

  it("is the same round for the same seed, and a reset moves to the next round", () => {
    expect(round("expert", 9).faults).toEqual(round("expert", 9).faults);
    const s = round("expert", 9);
    const next = reset(s);
    expect(next.seed).toBe(10);
    expect(next.mode).toBe("wontBoot");
    expect(next.tier).toBe("expert");
    expect(next.faults).toHaveLength(3);
    expect(next.placed.size).toBe(s.placed.size);
  });

  it("does not offer the other modes a fault", () => {
    for (const mode of ["guided", "free", "brief", "speedrun"] as const) expect(createGame({ mode }).faults).toEqual([]);
  });

  it("refuses to place anything: the machine is already built", () => {
    const s = round();
    const r = place(s, "psu", "slot_psu", 1);
    expect(r.result.ok).toBe(false);
    expect(r.state.placed).toBe(s.placed);
  });
});

describe("pressing power", () => {
  it("shows the symptoms at the tier's clue level and does not boot or cost a mistake", () => {
    for (const tier of ["easy", "normal", "hard"] as const) {
      const s = round(tier, 5);
      const r = powerOn(s, 1_000);
      expect(r.result.ok).toBe(false);
      expect(r.state.finishedAt).toBeNull();
      expect(r.state.mistakes).toBe(0);
      expect(r.state.last?.kind).toBe("noboot");
      for (const f of activeFaults(s)) for (const clue of faultClues(f, tier)) expect(r.state.message).toContain(clue);
    }
  });

  it("gives only beep codes on Hard, where the tier hides the symptoms", () => {
    const s = round("hard", 5);
    const r = powerOn(s, 1_000);
    for (const f of activeFaults(s)) expect(r.state.message).not.toContain(f.symptom);
    expect(tiers.hard.faultHints).toBe("beep-only");
  });

  it("starts the clock on the first press, and keeps it running after", () => {
    const first = powerOn(round(), 5_000).state;
    expect(first.startedAt).toBe(5_000);
    expect(powerOn(first, 9_000).state.startedAt).toBe(5_000);
  });

  it("boots once every fault is fixed", () => {
    let s = round("expert", 4);
    for (const f of activeFaults(s)) s = fix(s, f.fixPartId, REMEDY[f.id], 2_000).state;
    expect(s.faults).toEqual([]);
    const r = powerOn(s, 3_000);
    expect(r.result).toEqual({ ok: true });
    expect(r.state.finishedAt).toBe(3_000);
    expect(r.state.last?.kind).toBe("powered");
  });
});

describe("inspecting", () => {
  it("tells what is wrong with the faulty part, for free", () => {
    const s = round("easy", 2);
    const f = activeFaults(s)[0];
    const after = inspect(s, f.fixPartId, 1_000);
    expect(after.message).toContain(f.description);
    expect(after.selectedPart).toBe(f.fixPartId);
    expect(after.mistakes).toBe(0);
    expect(after.faults).toEqual(s.faults);
  });

  it("says a healthy part is fine, also for free", () => {
    const s = round("easy", 2);
    const healthy = ["psu", "gpu", "nvme", "ssd_sata"].find((id) => !activeFaults(s).some((f) => f.fixPartId === id))!;
    const after = inspect(s, healthy, 1_000);
    expect(after.message).toMatch(/nothing wrong/i);
    expect(after.mistakes).toBe(0);
  });

  it("does not start the clock by itself, but the first fix does", () => {
    const s = round("easy", 2);
    expect(select(s, "psu", 1_000).startedAt).toBeNull();
    const f = activeFaults(s)[0];
    expect(fix(s, f.fixPartId, REMEDY[f.id], 4_000).state.startedAt).toBe(4_000);
  });

  it("ignores a part that is not in the machine and any other mode", () => {
    const s = round();
    expect(inspect(s, "toString", 1)).toBe(s);
    const guided = createGame();
    expect(inspect(guided, "psu", 1)).toBe(guided);
  });
});

describe("fixing", () => {
  it("fixes the right part with the right action, and says what the fix was", () => {
    const s = round("normal", 6);
    const f = activeFaults(s)[0];
    const r = fix(s, f.fixPartId, REMEDY[f.id], 2_000);
    expect(r.result).toEqual({ ok: true });
    expect(r.state.faults).not.toContain(f.id);
    expect(r.state.fixed).toEqual([f.id]);
    expect(r.state.mistakes).toBe(0);
    expect(r.state.message).toContain(f.fix);
    // Its own event, not "placed": the scene replays placing animations (the cables draw in) on "placed".
    expect(r.state.last).toMatchObject({ kind: "fixed", partId: f.fixPartId });
  });

  it("counts a mistake, and changes nothing else, for a part that is fine", () => {
    const s = round("normal", 6);
    const healthy = ["psu", "gpu", "nvme", "ssd_sata"].find((id) => !activeFaults(s).some((f) => f.fixPartId === id))!;
    const r = fix(s, healthy, "reseat", 2_000);
    expect(r.result.ok).toBe(false);
    expect(r.state.mistakes).toBe(1);
    expect(r.state.faults).toEqual(s.faults);
    expect(r.state.last?.kind).toBe("rejected");
  });

  it("does not let a reseat fix the wrong memory generation, which has to be swapped", () => {
    // Find a round that carries it.
    let s = round("normal", 0);
    for (let seed = 0; seed < 200 && !s.faults.includes("wrong_ram_gen"); seed++) s = round("normal", seed);
    expect(s.faults).toContain("wrong_ram_gen");
    const reseat = fix(s, "ram_1", "reseat", 1_000);
    expect(reseat.result.ok).toBe(false);
    expect(reseat.state.mistakes).toBe(1);
    expect(reseat.state.faults).toContain("wrong_ram_gen");
    const swap = fix(s, "ram_1", "swap", 1_000);
    expect(swap.result).toEqual({ ok: true });
    expect(swap.state.faults).not.toContain("wrong_ram_gen");
    expect(swap.state.mistakes).toBe(0);
  });

  it("lets a swap fix a reseat fault but counts the wasted part as a mistake", () => {
    const s = round("easy", 2);
    const f = activeFaults(s).find((x) => REMEDY[x.id] === "reseat")!;
    const r = fix(s, f.fixPartId, "swap", 1_000);
    expect(r.result).toEqual({ ok: true });
    expect(r.state.mistakes).toBe(1);
    expect(r.state.faults).toEqual([]);
  });

  it("fixes each fault once: the same part again is a mistake", () => {
    const s = round("easy", 2);
    const f = activeFaults(s)[0];
    const once = fix(s, f.fixPartId, REMEDY[f.id], 1_000).state;
    const again = fix(once, f.fixPartId, REMEDY[f.id], 2_000);
    expect(again.result.ok).toBe(false);
    expect(again.state.mistakes).toBe(1);
  });

  it("says how many faults are left", () => {
    const s = round("expert", 4);
    const [a] = activeFaults(s);
    expect(fix(s, a.fixPartId, REMEDY[a.id], 1).state.message).toMatch(/2 more to find/);
    let t = s;
    for (const f of activeFaults(s)) t = fix(t, f.fixPartId, REMEDY[f.id], 1).state;
    expect(t.message).toMatch(/press power/i);
  });

  it("does nothing once the round is over, or outside Won't boot", () => {
    let s = round("easy", 2);
    for (const f of activeFaults(s)) s = fix(s, f.fixPartId, REMEDY[f.id], 1).state;
    s = powerOn(s, 2).state;
    expect(fix(s, "psu", "reseat", 3).result.ok).toBe(false);
    const guided = createGame();
    expect(fix(guided, "psu", "reseat", 1).result.ok).toBe(false);
    expect(fix(guided, "psu", "reseat", 1).state.mistakes).toBe(0);
  });
});

describe("scoring a round", () => {
  function playClean(tier: TierId, seconds: number, mistakes = 0) {
    let s = round(tier, 8);
    let t = 1_000;
    for (let i = 0; i < mistakes; i++) s = fix(s, "gpu", "reseat", t).state;
    for (const f of activeFaults(s)) {
      t += (seconds * 1000) / 4;
      s = fix(s, f.fixPartId, REMEDY[f.id], t).state;
    }
    return powerOn(s, 1_000 + seconds * 1000).state;
  }

  it("takes its par from the mode: 180 s at Normal", () => {
    expect(parSeconds("normal", "wontBoot")).toBe(180);
    expect(parSeconds("hard", "wontBoot")).toBe(153);
  });

  it("gives three stars for a quick clean fix, and fewer when slow or sloppy", () => {
    expect(scoreGame(playClean("normal", 60))?.stars).toBe(3);
    expect(scoreGame(playClean("normal", 400))?.stars).toBeLessThan(3);
    expect(scoreGame(playClean("hard", 60, 2))?.stars).toBeLessThan(3);
  });

  it("is not scored until the machine boots", () => {
    expect(scoreGame(round())).toBeNull();
  });
});
