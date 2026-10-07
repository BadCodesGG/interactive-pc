import { describe, expect, it } from "vitest";
import { createGame, place } from "./machine";
import { BENCH_OFFSET, TRAY_ORDER, displayOffset, isBenchPart, trayPosition } from "./layout";
import { bestKey, betterScore, readBest, writeBest } from "./best";

describe("tray layout", () => {
  it("gives every tray part its own spot on an arc in front of the case, clear of it", () => {
    expect(TRAY_ORDER).toHaveLength(17);
    expect(TRAY_ORDER[0]).toBe("psu");
    const spots = TRAY_ORDER.map((id) => trayPosition(id));
    for (const [x, y, z] of spots) {
      expect(y).toBe(0);
      expect(Math.hypot(x, z)).toBeGreaterThan(3.5); // the case fits in a 2.4 x 1.1 half-box
    }
    for (let i = 1; i < spots.length; i++) {
      const [ax, , az] = spots[i - 1];
      const [bx, , bz] = spots[i];
      expect(Math.hypot(bx - ax, bz - az)).toBeGreaterThan(0.7);
    }
  });

  it("shows the board and its parts on the bench until the board goes into the case", () => {
    let s = createGame();
    expect(isBenchPart("cpu") && isBenchPart("motherboard") && !isBenchPart("cooler")).toBe(true);
    expect(displayOffset(s, "cpu")).toEqual(BENCH_OFFSET);
    expect(displayOffset(s, "cooler")).toEqual([0, 0, 0]);
    for (const [part, slot] of [["psu", "slot_psu"], ["motherboard", "slot_motherboard"], ["cpu", "slot_cpu"], ["ram_2", "slot_ram_2"], ["ram_4", "slot_ram_4"], ["nvme", "slot_nvme"], ["motherboard", "slot_motherboard"]])
      s = place(s, part, slot).state;
    expect(s.placed.has("board_case")).toBe(true);
    expect(displayOffset(s, "cpu")).toEqual([0, 0, 0]);
  });
});

describe("local best", () => {
  it("prefers more stars, then less time", () => {
    expect(betterScore({ stars: 3, seconds: 200 }, { stars: 2, seconds: 100 })).toBe(true);
    expect(betterScore({ stars: 2, seconds: 90 }, { stars: 2, seconds: 100 })).toBe(true);
    expect(betterScore({ stars: 2, seconds: 110 }, { stars: 2, seconds: 100 })).toBe(false);
    expect(betterScore({ stars: 1, seconds: 10 }, undefined)).toBe(true);
  });

  it("keeps a best per tier in storage, and survives storage that throws", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(writeBest("normal", { stars: 2, seconds: 120 }, storage)).toBe(true);
    expect(writeBest("normal", { stars: 2, seconds: 150 }, storage)).toBe(false);
    expect(readBest(storage).normal).toEqual({ stars: 2, seconds: 120 });
    expect(mem.has("blowout-pc-best")).toBe(true);
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readBest(broken)).toEqual({});
    expect(writeBest("easy", { stars: 3, seconds: 1 }, broken)).toBe(false);
  });

  it("keeps guided bests under the bare tier name and every other mode under its own key", () => {
    expect(bestKey("guided", "normal")).toBe("normal");
    expect(bestKey("speedrun", "normal")).toBe("speedrun:normal");
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    writeBest(bestKey("guided", "normal"), { stars: 1, seconds: 400 }, storage);
    writeBest(bestKey("speedrun", "normal"), { stars: 3, seconds: 200 }, storage);
    expect(readBest(storage)).toEqual({ normal: { stars: 1, seconds: 400 }, "speedrun:normal": { stars: 3, seconds: 200 } });
  });
});
