import { describe, expect, it } from "vitest";
import { createGameStore } from "./store";

describe("game store modes", () => {
  it("starts in Guided at Normal", () => {
    const g = createGameStore().getState();
    expect([g.mode, g.tier]).toEqual(["guided", "normal"]);
  });

  it("switches mode, restarts the build, and keeps the tier when the mode offers it", () => {
    const game = createGameStore({ tier: "hard" });
    game.select("psu");
    game.setMode("brief");
    const s = game.getState();
    expect([s.mode, s.tier]).toEqual(["brief", "hard"]);
    expect(s.selectedPart).toBeNull();
    expect(s.placed.size).toBe(0);
    expect(s.message).toMatch(/Brief/);
  });

  it("does not say the build starts again when nothing has been built", () => {
    const game = createGameStore();
    game.setMode("brief");
    expect(game.getState().message).toBeNull();
    game.setTier("hard");
    expect(game.getState().message).toBe("Difficulty set to Hard.");
    game.select("psu");
    game.setTier("easy");
    expect(game.getState().message).toBe("Difficulty set to Easy. The build starts again.");
  });

  it("says Free's start line without repeating the mode card", () => {
    const game = createGameStore();
    game.setMode("free");
    expect(game.getState().message).toBe("Free build. Pick any part from the tray and place it.");
  });

  it("clamps the tier to the nearest one the new mode offers", () => {
    const game = createGameStore({ tier: "easy" });
    game.setMode("speedrun");
    expect(game.getState().tier).toBe("normal");
    game.setMode("free");
    expect(game.getState().tier).toBe("normal");
  });

  it("keeps the mode when the tier changes, and ignores a switch to the mode already in use", () => {
    const game = createGameStore({ mode: "speedrun" });
    game.setTier("expert");
    expect(game.getState().mode).toBe("speedrun");
    let calls = 0;
    game.subscribe(() => calls++);
    game.setMode("speedrun");
    expect(calls).toBe(0);
  });

  it("starts Won't boot with faults, and a reset deals a new round", () => {
    let n = 0;
    const game = createGameStore({ seed: () => ++n * 7 });
    game.setMode("wontBoot");
    const first = game.getState();
    expect(first.faults.length).toBeGreaterThan(0);
    expect(first.seed).toBe(7);
    game.reset();
    expect(game.getState().seed).toBe(14);
    expect(game.getState().mode).toBe("wontBoot");
    expect(game.getState().message).toMatch(/new machine/i);
  });

  it("inspects and fixes the selected part, and does nothing with no selection", () => {
    const game = createGameStore({ mode: "wontBoot", tier: "easy", seed: () => 2 });
    expect(game.fix("reseat")).toBeNull();
    game.inspect();
    expect(game.getState().message).toBeNull();
    const fault = game.getState().faults[0];
    const part = { half_seated_ram: "ram_2", missing_eps: "cables", gpu_power_unplugged: "cables" }[fault]!;
    game.select(part);
    game.inspect();
    expect(game.getState().message).toBeTruthy();
    expect(game.fix("reseat")).toEqual({ ok: true });
    expect(game.getState().faults).toEqual([]);
  });

  it("passes the sheet's picks on to the rules, and keeps them across a restart", () => {
    const game = createGameStore({ mode: "free" });
    const picks = { ...game.getState().picks, cooler: "cooler_tidal_240" };
    game.setPicks(picks);
    expect(game.getState().picks).toBe(picks);
    game.setTier("easy");
    expect(game.getState().picks).toBe(picks);
    game.setMode("brief");
    expect(game.getState().picks).toBe(picks);
  });
});
