import { describe, expect, it } from "vitest";
import { assemblySteps } from "@/data/assembly";
import { defaultPickIds } from "@/data/showcase";
import type { Picks } from "@/data/compat";
import { FREE_NEEDS, freeCheck, freeMissing } from "./free-rules";
import { createGame, place, select, type GameState } from "./machine";

const step = (id: string) => assemblySteps.find((s) => s.id === id)!;
const partOf = (id: string) => step(id).partId;

/** Every step a step needs, following the guided `after` lists all the way back. */
function guidedClosure(id: string, seen = new Set<string>()): Set<string> {
  for (const dep of step(id).after) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    guidedClosure(dep, seen);
  }
  return seen;
}

/** Plays steps in the order given through the real machine in Free mode; returns the state and every result. */
function play(ids: string[], picks: Picks = defaultPickIds) {
  let s: GameState = createGame({ mode: "free", picks });
  const results: Record<string, { ok: boolean; reason?: string }> = {};
  for (const id of ids) {
    const st = step(id);
    if (st.kind === "action") continue;
    for (const sub of st.subSteps ?? []) s = { ...s, subDone: new Set(s.subDone).add(sub.id) };
    s = select(s, st.partId, 1);
    const r = place(s, st.partId, st.slotId, 1);
    results[id] = r.result;
    s = r.state;
  }
  return { s, results };
}

describe("the free prerequisites are derived from the guided ones", () => {
  it("name a real step for every place step, and only real steps", () => {
    const ids = assemblySteps.map((s) => s.id);
    for (const st of assemblySteps.filter((x) => x.kind === "place")) {
      expect(FREE_NEEDS, st.id).toHaveProperty(st.id);
      for (const dep of FREE_NEEDS[st.id]) expect(ids, `${st.id} needs ${dep}`).toContain(dep);
    }
  });

  it("never ask for more than the guided order does, so every guided build is a valid free build", () => {
    for (const [id, deps] of Object.entries(FREE_NEEDS)) {
      const guided = guidedClosure(id);
      for (const dep of deps) expect(guided.has(dep), `${id} needs ${dep}`).toBe(true);
    }
  });

  it("are a real loosening where the guided order is only a recommendation", () => {
    // Memory and the drive need the board, not the CPU; the board can go into the case before any of them.
    expect(FREE_NEEDS.ram_2).toEqual(["board_bench"]);
    expect(FREE_NEEDS.board_case).toEqual(["board_bench"]);
    expect(FREE_NEEDS.ssd_sata).toEqual([]);
    expect(FREE_NEEDS.fan_front).toEqual([]);
  });

  it("accept the guided order from start to finish", () => {
    const order = assemblySteps.filter((s) => s.kind === "place").map((s) => s.id);
    const { results } = play(order);
    for (const id of order) expect(results[id], id).toEqual({ ok: true });
  });
});

describe("freeMissing", () => {
  const none = new Set<string>();
  it("needs the board before anything goes on it", () => {
    for (const id of ["cpu", "ram_2", "ram_4", "nvme"]) expect(freeMissing(assemblySteps, none, step(id)), id).toEqual(["board_bench"]);
  });

  it("does not need the memory, CPU or drive to move the board into the case", () => {
    expect(freeMissing(assemblySteps, new Set(["board_bench"]), step("board_case"))).toEqual([]);
  });

  it("needs every mandatory part in before a panel, but not the optional memory", () => {
    const all = assemblySteps.filter((s) => s.kind === "place" && !s.id.startsWith("panel_") && !s.optional).map((s) => s.id);
    expect(freeMissing(assemblySteps, new Set(all), step("panel_left"))).toEqual([]);
    const missing = freeMissing(assemblySteps, new Set(), step("panel_left"));
    expect(missing).toContain("cpu");
    expect(missing).not.toContain("ram_1");
    expect(missing).not.toContain("panel_right");
  });
});

describe("free play through the machine", () => {
  it("lets the memory go in before the CPU, which the guided order does not", () => {
    const { results } = play(["psu", "board_bench", "ram_2", "cpu"]);
    expect(results.ram_2).toEqual({ ok: true });
    expect(results.cpu).toEqual({ ok: true });
  });

  it("lets the board go straight into the case, and the power supply go in after it", () => {
    const { results } = play(["board_bench", "board_case", "psu", "cpu"]);
    expect(results.board_case).toEqual({ ok: true });
    expect(results.psu).toEqual({ ok: true });
    expect(results.cpu).toEqual({ ok: true });
  });

  it("refuses the cooler before the CPU, with the reason", () => {
    const { results, s } = play(["board_bench", "board_case", "cooler"]);
    expect(results.cooler.ok).toBe(false);
    expect(results.cooler.reason).toMatch(/cooler goes on after the CPU/i);
    expect(s.mistakes).toBe(1);
  });

  it("refuses the cooler with the board still on the bench", () => {
    const { results } = play(["board_bench", "cpu", "cooler"]);
    expect(results.cooler.ok).toBe(false);
    expect(results.cooler.reason).toMatch(/board/i);
  });

  it("refuses a side panel before the internals are in", () => {
    const { results, s } = play(["panel_left"]);
    expect(results.panel_left.ok).toBe(false);
    expect(s.placed.has("panel_left")).toBe(false);
  });

  it("refuses the graphics card before the NVMe drive, which it would cover, but not after", () => {
    const base = ["psu", "board_bench", "board_case"];
    const early = play([...base, "gpu"]);
    expect(early.results.gpu.ok).toBe(false);
    expect(early.results.gpu.reason).toMatch(/NVMe/i);
    expect(play(["psu", "board_bench", "nvme", "board_case", "gpu"]).results.gpu).toEqual({ ok: true });
  });

  it("refuses an air tower before the memory, which it would overhang, but a liquid cooler is fine", () => {
    const upTo = ["psu", "board_bench", "cpu", "nvme", "board_case", "cooler"];
    const tower = play(upTo, defaultPickIds);
    expect(tower.results.cooler.ok).toBe(false);
    expect(tower.results.cooler.reason).toMatch(/memory/i);
    const aio = play([...upTo, "ram_2"], { ...defaultPickIds, cooler: "cooler_tidal_240" });
    expect(aio.results.cooler).toEqual({ ok: true });
    expect(aio.results.ram_2).toEqual({ ok: true });
  });

  it("never strands the player: any legal free order reaches the point where the panels can go on", () => {
    const mandatory = assemblySteps.filter((x) => x.kind === "place" && !x.optional);
    for (const picks of [defaultPickIds, { ...defaultPickIds, cooler: "cooler_tidal_240" }, { ...defaultPickIds, cooler: "cooler_monolith_dual" }]) {
      for (let seed = 1; seed <= 150; seed++) {
        let a = seed;
        const next = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296;
        let s: GameState = createGame({ mode: "free", picks });
        for (let guard = 0; guard < 100; guard++) {
          const open = mandatory.filter((x) => !s.placed.has(x.id));
          if (open.length === 0) break;
          // Try every open step in a random order until one is accepted: a refusal is fine, a dead end is not.
          const order = [...open].sort(() => next() - 0.5);
          let moved = false;
          for (const st of order) {
            for (const sub of st.subSteps ?? []) s = { ...s, subDone: new Set(s.subDone).add(sub.id) };
            const r = place(select(s, st.partId, 1), st.partId, st.slotId, 1);
            if (r.result.ok) {
              s = r.state;
              moved = true;
              break;
            }
          }
          expect(moved, `seed ${seed} stuck with ${open.map((x) => x.id).join(",")} open`).toBe(true);
        }
        expect(mandatory.every((x) => s.placed.has(x.id)), `seed ${seed}`).toBe(true);
      }
    }
  });

  it("refuses the cables before the board is in the case", () => {
    const { results } = play(["board_bench", "cables"]);
    expect(results.cables.ok).toBe(false);
  });

  it("allows what is only a recommendation, with a warning, and does not count a mistake", () => {
    // The power supply after the board is a squeeze, not an impossibility.
    const { results, s } = play(["board_bench", "psu"]);
    expect(results.psu).toEqual({ ok: true });
    expect(s.mistakes).toBe(0);
    expect(s.message).toMatch(/squeeze/i);
  });

  it("can be finished in a non-guided order and powered on", () => {
    const order = ["board_bench", "ram_4", "ram_2", "nvme", "cpu", "psu", "board_case", "gpu", "cooler", "fan_rear", "fan_front", "ssd_sata", "cables", "panel_front", "panel_right", "panel_left"];
    const { s, results } = play(order);
    for (const id of order) expect(results[id], id).toEqual({ ok: true });
    expect(s.mistakes).toBe(0);
  });
});

describe("freeCheck", () => {
  it("has nothing to say about a part with nothing in its way", () => {
    expect(freeCheck(defaultPickIds, [], "psu")).toEqual({ block: null, warn: null });
  });

  it("blocks with a sentence, and warns without blocking", () => {
    expect(freeCheck(defaultPickIds, ["motherboard"], "cooler").block).toMatch(/CPU/);
    expect(freeCheck(defaultPickIds, ["motherboard"], "psu")).toEqual({ block: null, warn: expect.stringMatching(/squeeze/i) });
    expect(partOf("cooler")).toBe("cooler");
  });

  it("does not repeat a warning it already gave", () => {
    expect(freeCheck(defaultPickIds, ["motherboard", "psu"], "cpu").warn).toBeNull();
  });

  it("never throws on a placed list with repeats", () => {
    expect(() => freeCheck(defaultPickIds, ["motherboard", "motherboard", "cpu"], "cooler")).not.toThrow();
  });
});
