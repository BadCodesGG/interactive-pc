import { describe, expect, it } from "vitest";
import { faults, modes, tiers, type ModeId, type TierId } from "@/data/modes";
import { BUILD_MODES, beepWords, clampTier, faultClues, modeView, tierBlurb } from "./mode-view";

describe("the modes offered", () => {
  it("lists all five, guided first, each from modes.ts", () => {
    expect(BUILD_MODES).toEqual(["guided", "free", "brief", "wontBoot", "speedrun"]);
    for (const id of BUILD_MODES) expect(modes[id].id).toBe(id);
  });
});

describe("clampTier", () => {
  it("keeps a tier the mode offers", () => {
    expect(clampTier("guided", "hard")).toBe("hard");
    expect(clampTier("brief", "expert")).toBe("expert");
  });

  it("moves to the nearest offered tier, easier on a tie", () => {
    expect(clampTier("speedrun", "easy")).toBe("normal");
    expect(clampTier("free", "hard")).toBe("normal");
    expect(clampTier("free", "expert")).toBe("normal");
    expect(clampTier("guided", "expert")).toBe("hard");
  });

  it("always lands on a tier the mode offers", () => {
    const all: TierId[] = ["easy", "normal", "hard", "expert"];
    for (const mode of BUILD_MODES) for (const tier of all) expect(modes[mode].tiers).toContain(clampTier(mode, tier));
  });
});

describe("modeView", () => {
  it("scales par by the tier, and has none where the mode has none", () => {
    // Guided: 300 s at Normal, 1.5 x on Easy, 0.85 x on Hard.
    expect(modeView("guided", "normal").parSeconds).toBe(300);
    expect(modeView("guided", "easy").parSeconds).toBe(450);
    expect(modeView("guided", "hard").parSeconds).toBe(255);
    // Speedrun: 240 s at Normal, 0.75 x on Expert.
    expect(modeView("speedrun", "expert").parSeconds).toBe(180);
    expect(modeView("free", "normal").parSeconds).toBeNull();
  });

  it("clamps the tier it reports", () => {
    expect(modeView("speedrun", "easy").tier.id).toBe("normal");
  });

  it("follows the mode's flags for the clock, the score, the budget and swapping", () => {
    const flags = (m: ModeId) => {
      const v = modeView(m, "normal");
      return [v.showTimer, v.scored, v.showBudget, v.canSwap];
    };
    expect(flags("guided")).toEqual([true, true, false, false]);
    expect(flags("free")).toEqual([false, false, false, true]);
    expect(flags("brief")).toEqual([true, true, true, true]);
    expect(flags("wontBoot")).toEqual([true, true, false, false]);
    expect(flags("speedrun")).toEqual([true, true, false, false]);
  });

  it("offers a tier list per mode, straight from modes.ts", () => {
    expect(modeView("speedrun", "normal").tiers).toEqual(["normal", "hard", "expert"]);
    expect(modeView("free", "normal").tiers).toEqual(["easy", "normal"]);
  });
});

describe("beepWords", () => {
  it("reads S and L as short and long, and silence as none", () => {
    expect(beepWords("SSS")).toBe("short, short, short");
    expect(beepWords("LSS")).toBe("long, short, short");
    expect(beepWords("SLSL")).toBe("short, long, short, long");
    expect(beepWords("")).toBe("no beeps");
  });
});

describe("faultClues", () => {
  const fault = faults.half_seated_ram;

  it("gives everything at the lowest tiers: symptom, beep code and the reading of it", () => {
    expect(faultClues(fault, "easy")).toEqual([fault.symptom, "Beeps: short, short, short.", fault.beepHint]);
  });

  it("gives the symptom and the beep code on Normal", () => {
    expect(faultClues(fault, "normal")).toEqual([fault.symptom, "Beeps: short, short, short."]);
  });

  it("gives only the beep code on Hard and Expert", () => {
    expect(faultClues(fault, "hard")).toEqual(["Beeps: short, short, short."]);
    expect(faultClues(fault, "expert")).toEqual(["Beeps: short, short, short."]);
  });

  it("says so plainly when the machine is silent, without repeating what the symptom says", () => {
    const f = faults.missing_eps;
    expect(faultClues(f, "hard")).toEqual(["No beeps at all."]);
    expect(faultClues(f, "normal")).toEqual([f.symptom]);
    expect(faultClues(f, "easy")).toEqual([f.symptom, f.beepHint]);
  });

  it("never gives away the fix or the cause", () => {
    for (const f of Object.values(faults)) {
      for (const tier of ["easy", "normal", "hard", "expert"] as const) {
        const text = faultClues(f, tier).join(" ");
        expect(text).not.toContain(f.fix);
        expect(text).not.toContain(f.description);
      }
    }
  });
});

describe("tierBlurb", () => {
  it("keeps the tier's own blurb where it is true of the mode", () => {
    expect(tierBlurb("guided", "normal")).toBe(tiers.normal.blurb);
    expect(tierBlurb("speedrun", "hard")).toBe(tiers.hard.blurb);
  });

  it("does not promise Free a clock or a locked order", () => {
    for (const tier of modes.free.tiers) expect(tierBlurb("free", tier)).not.toMatch(/mistakes|locked|held against/i);
  });

  it("describes Won't boot by its faults and clues, for every tier it offers", () => {
    for (const tier of modes.wontBoot.tiers) {
      const text = tierBlurb("wontBoot", tier);
      expect(text).toMatch(/fault/);
      expect(text).not.toMatch(/slot|glow|highlight/i);
    }
  });
});
