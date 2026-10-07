import { describe, expect, it } from "vitest";
import { assemblySteps } from "@/data/assembly";
import { createGame, place, select, type GameState } from "./machine";
import { installedParts } from "./installed";
import { TRAY_ORDER } from "./layout";

function play(ids: string[], mode: "guided" | "free" = "guided"): GameState {
  let s = createGame({ mode });
  for (const id of ids) {
    const st = assemblySteps.find((x) => x.id === id)!;
    s = { ...s, subDone: new Set([...s.subDone, ...(st.subSteps ?? []).map((x) => x.id)]) };
    s = place(select(s, st.partId, 1), st.partId, st.slotId, 1).state;
  }
  return s;
}

describe("installedParts", () => {
  it("is empty at the start: everything is on the tray", () => {
    expect(installedParts(createGame())).toEqual(new Set());
  });

  it("counts a part once its step is done", () => {
    expect(installedParts(play(["psu"]))).toEqual(new Set(["psu"]));
  });

  it("does not count parts on the board while it is still on the bench", () => {
    const s = play(["psu", "board_bench", "cpu", "ram_2", "ram_4", "nvme"]);
    expect(installedParts(s)).toEqual(new Set(["psu"]));
  });

  it("counts the board and its parts once the board is in the case", () => {
    const s = play(["psu", "board_bench", "cpu", "ram_2", "ram_4", "nvme", "board_case"]);
    expect(installedParts(s)).toEqual(new Set(["psu", "motherboard", "cpu", "ram_2", "ram_4", "nvme"]));
  });

  it("leaves out parts not yet fitted, however many others are in", () => {
    const s = play(["psu", "board_bench", "cpu", "ram_2", "ram_4", "nvme", "board_case", "cooler"]);
    const inside = installedParts(s);
    expect(inside.has("cooler")).toBe(true);
    for (const id of ["gpu", "fan_front", "fan_rear", "ssd_sata", "cables", "ram_1", "ram_3"]) expect(inside.has(id), id).toBe(false);
  });

  it("follows a free build's own order", () => {
    const s = play(["board_bench", "board_case", "ram_2"], "free");
    expect(installedParts(s)).toEqual(new Set(["motherboard", "ram_2"]));
  });

  it("counts every part of a Won't boot machine, which arrives built", () => {
    const s = createGame({ mode: "wontBoot" });
    expect(installedParts(s)).toEqual(new Set(TRAY_ORDER));
  });

  it("never names a part that is not in the tray order", () => {
    const s = play(assemblySteps.filter((x) => x.kind === "place").map((x) => x.id));
    for (const id of installedParts(s)) expect(TRAY_ORDER).toContain(id);
  });
});
