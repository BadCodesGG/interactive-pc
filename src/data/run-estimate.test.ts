import { describe, expect, it } from "vitest";
import { byKind } from "./catalogue";
import { CPU_SCORE, ESTIMATE_DISCLAIMER, GPU_SCORE, RESOLUTIONS, estimateTable, genres, verdictFor } from "./run-estimate";

const cell = (t: ReturnType<typeof estimateTable>, genre: string, res: string) => t.find((r) => r.genre.id === genre)!.cells.find((c) => c.resolution === res)!;

describe("the score tables", () => {
  it("score every CPU and GPU in the catalogue, and nothing else", () => {
    expect(Object.keys(CPU_SCORE).sort()).toEqual(byKind("cpu").map((c) => c.id).sort());
    expect(Object.keys(GPU_SCORE).sort()).toEqual(byKind("gpu").map((c) => c.id).sort());
  });

  it("rank the parts in the same order as their price within a socket family", () => {
    expect(CPU_SCORE.cpu_apex_16).toBeGreaterThan(CPU_SCORE.cpu_vertex_12_new);
    expect(CPU_SCORE.cpu_vertex_12_new).toBeGreaterThan(CPU_SCORE.cpu_vertex_8);
    expect(GPU_SCORE.gpu_titan_24).toBeGreaterThan(GPU_SCORE.gpu_nova_16);
    expect(GPU_SCORE.gpu_nova_16).toBeGreaterThan(GPU_SCORE.gpu_nova_12);
    expect(GPU_SCORE.gpu_nova_12).toBeGreaterThan(GPU_SCORE.gpu_nova_8);
  });
});

describe("the table's shape", () => {
  it("has a row per genre and a cell per resolution, in order", () => {
    const t = estimateTable({ cpu: "cpu_vertex_8", gpu: "gpu_nova_16" });
    expect(t.map((r) => r.genre.id)).toEqual(genres.map((g) => g.id));
    expect(RESOLUTIONS.map((r) => r.id)).toEqual(["1080p", "1440p", "4k"]);
    for (const row of t) expect(row.cells.map((c) => c.resolution)).toEqual(["1080p", "1440p", "4k"]);
    expect(genres.length).toBeGreaterThanOrEqual(5);
  });

  it("says the parts and genres are invented", () => {
    expect(ESTIMATE_DISCLAIMER).toMatch(/invented/i);
  });
});

describe("worked examples (by hand)", () => {
  const t = estimateTable({ cpu: "cpu_vertex_8", gpu: "gpu_nova_16" });

  it("a fast game is limited by the CPU at 1080p", () => {
    // Arena shooter: the card could do 1.9 x 260 = 494 fps at 1080p, the 8-core gives 1.0 x 300 = 300.
    const c = cell(t, "arena", "1080p");
    expect(c.fps).toBe(300);
    expect(c.limitedBy).toBe("cpu");
    // At 4K the card gives 494 / 3.6 = 137.2.
    expect(cell(t, "arena", "4k").fps).toBe(137);
  });

  it("a heavy game at 4K is limited by the card", () => {
    // Open world: 1.9 x 85 / 3.6 = 44.86, the CPU allows 110.
    const c = cell(t, "openworld", "4k");
    expect(c.fps).toBe(45);
    expect(c.limitedBy).toBe("gpu");
    expect(c.verdict).toBe("playable");
  });

  it("a CPU-bound genre shows the CPU limit even on the biggest card", () => {
    const big = estimateTable({ cpu: "cpu_ember_6", gpu: "gpu_titan_24" });
    const c = cell(big, "strategy", "4k");
    expect(c.limitedBy).toBe("cpu");
    // 0.7 x 70 = 49.
    expect(c.fps).toBe(49);
  });
});

describe("monotonic behaviour", () => {
  it("never loses frames when the card gets better, or when the resolution drops", () => {
    const gpus = ["gpu_nova_8", "gpu_nova_12", "gpu_nova_16", "gpu_titan_24"];
    for (const genre of genres) {
      let prev = 0;
      for (const gpu of gpus) {
        const row = estimateTable({ cpu: "cpu_apex_16", gpu }).find((r) => r.genre.id === genre.id)!;
        const [p1080, p1440, p4k] = row.cells.map((c) => c.fps);
        expect(p1080).toBeGreaterThanOrEqual(p1440);
        expect(p1440).toBeGreaterThanOrEqual(p4k);
        expect(p1080).toBeGreaterThanOrEqual(prev);
        prev = p1080;
      }
    }
  });

  it("never loses frames when the CPU gets better", () => {
    const cpus = ["cpu_ember_6", "cpu_vertex_8", "cpu_vertex_12_new", "cpu_apex_16"];
    for (const genre of genres) {
      let prev = 0;
      for (const cpu of cpus) {
        const c = estimateTable({ cpu, gpu: "gpu_titan_24" }).find((r) => r.genre.id === genre.id)!.cells[0];
        expect(c.fps).toBeGreaterThanOrEqual(prev);
        prev = c.fps;
      }
    }
  });

  it("gives a positive whole number of frames and a verdict in every cell, for every pair", () => {
    for (const cpu of byKind("cpu")) {
      for (const gpu of byKind("gpu")) {
        for (const row of estimateTable({ cpu: cpu.id, gpu: gpu.id })) {
          for (const c of row.cells) {
            expect(Number.isInteger(c.fps) && c.fps > 0, `${cpu.id} ${gpu.id} ${row.genre.id}`).toBe(true);
            expect(c.verdict).toBe(verdictFor(c.fps));
          }
        }
      }
    }
  });
});

describe("verdicts", () => {
  it("cut at 30, 60 and 120 frames", () => {
    expect([29, 30, 59, 60, 119, 120].map(verdictFor)).toEqual(["struggles", "playable", "playable", "smooth", "smooth", "fast"]);
  });
});

describe("bad input", () => {
  it("throws a clear error for a part that is not scored, rather than returning NaN", () => {
    expect(() => estimateTable({ cpu: "cpu_nope", gpu: "gpu_nova_8" })).toThrow(/cpu_nope/);
    expect(() => estimateTable({ cpu: "cpu_vertex_8", gpu: "toString" })).toThrow(/toString/);
  });
});
