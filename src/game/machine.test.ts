import { describe, expect, it } from "vitest";
import { assemblySteps, wrongPlacementMessages } from "@/data/assembly";
import { applySubStep, createGame, hint, nextBlocker, parSeconds, place, powerOn, refusalOf, reset, scoreGame, select, trayParts, type GameState } from "./machine";
import type { ModeId } from "@/data/modes";

/** Plays every step in the recommended order, one second apart, and returns the final state. */
function playHappyPath(tier: "easy" | "normal" | "hard" = "normal", secondsPerStep = 1, mode: ModeId = "guided") {
  let s = createGame({ tier, mode });
  let t = 1_000;
  for (const step of assemblySteps) {
    t += secondsPerStep * 1000;
    for (const sub of step.subSteps ?? []) s = applySubStep(s, sub.id, t);
    if (step.kind === "action") {
      const r = powerOn(s, t);
      expect(r.result, step.id).toEqual({ ok: true });
      s = r.state;
      continue;
    }
    s = select(s, step.partId, t);
    const r = place(s, step.partId, step.slotId, t);
    expect(r.result, step.id).toEqual({ ok: true });
    s = r.state;
  }
  return s;
}

describe("game machine", () => {
  it("completes the guided order with zero mistakes", () => {
    const s = playHappyPath();
    expect(s.mistakes).toBe(0);
    expect(s.placed.size).toBe(assemblySteps.length);
    expect(s.finishedAt).not.toBeNull();
    expect(s.activeStep).toBeNull();
    expect(trayParts(s)).toEqual([]);
  });

  it("rejects the cooler before the CPU with the cooler's own reason, and counts a mistake", () => {
    const s = createGame({ tier: "normal" });
    const { state, result } = place(select(s, "cooler", 0), "cooler", "slot_cooler", 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("The cooler goes on after the CPU");
    expect(state.mistakes).toBe(1);
    expect(state.placed.has("cooler")).toBe(false);
    expect(state.message).toBe(result.reason);
  });

  it("rejects a part dropped on another part's slot", () => {
    const { state, result } = place(createGame(), "psu", "slot_gpu", 0);
    expect(result).toEqual({ ok: false, reason: wrongPlacementMessages.wrong_slot });
    expect(state.mistakes).toBe(1);
  });

  it("hides the rule's reason on Hard but still refuses the placement", () => {
    const { result } = place(createGame({ tier: "hard" }), "cooler", "slot_cooler", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toContain("The cooler goes on after the CPU");
  });

  it("refuses the cooler until the thermal paste is on", () => {
    let s = createGame();
    for (const step of assemblySteps) {
      if (step.id === "cooler") break;
      s = place(s, step.partId, step.slotId, 0).state;
    }
    const noPaste = place(s, "cooler", "slot_cooler", 0);
    expect(noPaste.result).toEqual({ ok: false, reason: wrongPlacementMessages.cooler_no_paste });
    expect(place(applySubStep(s, "paste", 0), "cooler", "slot_cooler", 0).result).toEqual({ ok: true });
  });

  it("moves the motherboard twice: onto the bench, then into the case once its parts are on", () => {
    let s = createGame();
    s = place(s, "psu", "slot_psu", 0).state;
    s = place(s, "motherboard", "slot_motherboard", 0).state;
    expect(s.placed.has("board_bench")).toBe(true);
    expect(trayParts(s)).not.toContain("motherboard");
    const early = place(s, "motherboard", "slot_motherboard", 0);
    expect(early.result.ok).toBe(false);
    for (const id of ["cpu", "ram_2", "ram_4", "nvme"]) s = place(s, id, `slot_${id}`, 0).state;
    expect(trayParts(s)).toContain("motherboard");
    expect(place(s, "motherboard", "slot_motherboard", 0).result).toEqual({ ok: true });
  });

  it("will not power on before the panels are closed", () => {
    const { state, result } = powerOn(createGame(), 0);
    expect(result.ok).toBe(false);
    expect(state.finishedAt).toBeNull();
  });

  it("starts the clock on the first move, points at the next step, and resets", () => {
    let s: GameState = createGame();
    expect(s.startedAt).toBeNull();
    expect(s.activeStep).toBe("psu");
    s = select(s, "psu", 5_000);
    expect(s.startedAt).toBe(5_000);
    expect(s.selectedPart).toBe("psu");
    const h = hint(s);
    expect(h.text).toBe(assemblySteps[0].hint);
    s = place(s, "psu", "slot_psu", 6_000).state;
    expect(s.activeStep).toBe("board_bench");
    expect(s.selectedPart).toBeNull();
    const fresh = reset(s);
    expect(fresh.placed.size).toBe(0);
    expect(fresh.startedAt).toBeNull();
    expect(fresh.tier).toBe(s.tier);
  });

  it("scores a clean build under par at three stars, and a slow one lower", () => {
    const quick = scoreGame(playHappyPath("normal", 1));
    expect(quick?.stars).toBe(3);
    const slow = scoreGame(playHappyPath("normal", 60));
    expect(slow?.stars).toBe(2);
    expect(scoreGame(createGame())).toBeNull();
  });

  it("defaults to the guided mode, and reset keeps the mode", () => {
    expect(createGame().mode).toBe("guided");
    expect(reset(createGame({ mode: "speedrun", tier: "hard" })).mode).toBe("speedrun");
  });

  it("takes par from the mode: guided 300 s and speedrun 240 s at Normal", () => {
    expect(parSeconds("normal")).toBe(300);
    expect(parSeconds("normal", "speedrun")).toBe(240);
    expect(parSeconds("expert", "speedrun")).toBe(180);
    expect(createGame({ mode: "speedrun" }).mode).toBe("speedrun");
  });

  it("scores a speedrun against its own par: 250 s is over speedrun par but inside guided par", () => {
    const run = (mode: ModeId) => scoreGame(playHappyPath("normal", 250 / (assemblySteps.length - 1), mode));
    expect(run("guided")?.stars).toBe(3);
    expect(run("speedrun")?.stars).toBe(2);
  });

  it("does not score the free sandbox", () => {
    const s = playHappyPath("normal", 1, "free");
    expect(s.finishedAt).not.toBeNull();
    expect(scoreGame(s)).toBeNull();
  });
});

describe("refusals", () => {
  const step = (id: string) => assemblySteps.find((x) => x.id === id)!;

  it("names the step that can be done now, not the nearest one that is missing", () => {
    // The CPU waits on the board, which waits on the power supply: the power supply is the next step.
    const s = createGame();
    expect(nextBlocker(s, step("cpu"))?.id).toBe("psu");
    const { result } = place(select(s, "cpu", 0), "cpu", "slot_cpu", 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("First: fit the power supply.");
    expect(result.reason).not.toContain("motherboard");
  });

  it("moves on to the next step once the power supply is in", () => {
    const s = place(createGame(), "psu", "slot_psu", 0).state;
    expect(nextBlocker(s, step("cpu"))?.id).toBe("board_bench");
    expect(nextBlocker(s, step("board_bench"))).toBeUndefined();
  });

  it("points Power on at a real step too, and stays silent about it on Hard", () => {
    const { result } = powerOn(createGame({ tier: "normal" }), 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("First: fit the power supply.");
    const hard = powerOn(createGame({ tier: "hard" }), 0).result;
    expect(hard.ok).toBe(false);
    if (!hard.ok) expect(hard.reason).not.toContain("First:");
  });

  it("follows Free's own prerequisites: the cooler waits on the board in the case", () => {
    const s = createGame({ mode: "free" });
    expect(nextBlocker(s, step("cooler"))?.id).toBe("board_bench");
  });

  it("is a refusal only while the refusal is the last thing said", () => {
    const s = createGame();
    expect(refusalOf(s)).toBeNull();
    const refused = place(select(s, "cpu", 0), "cpu", "slot_cpu", 0).state;
    expect(refusalOf(refused)).toBe(refused.message);
    expect(refusalOf(hint(refused).state)).toBeNull();
    expect(refusalOf(place(refused, "psu", "slot_psu", 0).state)).toBeNull();
  });
});
