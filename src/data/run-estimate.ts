/**
 * What will it run: frames per second by game genre and resolution, from the picked CPU and GPU.
 *
 * Everything here is invented: the parts are the catalogue's made-up ones, the genres are broad
 * made-up categories, and the scores are not measurements. A genre has two numbers, what a score
 * of 100 gets in it (from the card at 1080p, from the processor at any resolution), and the result
 * is whichever is lower. Pixels cost frames, so the card's figure falls with resolution.
 */

export type Resolution = "1080p" | "1440p" | "4k";
export type Verdict = "struggles" | "playable" | "smooth" | "fast";

export const ESTIMATE_DISCLAIMER = "An estimate for invented parts and invented game genres, not a benchmark.";

/** How much more a frame costs the card than at 1080p (the pixel ratio). */
export const RESOLUTIONS: { id: Resolution; label: string; cost: number }[] = [
  { id: "1080p", label: "1080p", cost: 1 },
  { id: "1440p", label: "1440p", cost: 1.8 },
  { id: "4k", label: "4K", cost: 3.6 },
];

/** Relative speed, 100 = the middle of the range. Keyed by catalogue id. */
export const CPU_SCORE: Record<string, number> = {
  cpu_ember_6: 70,
  cpu_vertex_8: 100,
  cpu_vertex_12_new: 135,
  cpu_apex_16: 170,
};
export const GPU_SCORE: Record<string, number> = {
  gpu_nova_8: 100,
  gpu_nova_12: 140,
  gpu_nova_16: 190,
  gpu_titan_24: 280,
};

export interface Genre {
  id: string;
  label: string;
  blurb: string;
  /** Frames per second a GPU score of 100 gets at 1080p. */
  gpuFps: number;
  /** Frames per second a CPU score of 100 gets, at any resolution. */
  cpuFps: number;
}

export const genres: Genre[] = [
  { id: "arena", label: "Arena shooter", blurb: "Fast and light: the processor sets the ceiling.", gpuFps: 260, cpuFps: 300 },
  { id: "racing", label: "Racing sim", blurb: "Smooth frames and long draw distances.", gpuFps: 120, cpuFps: 140 },
  { id: "openworld", label: "Open-world action", blurb: "Big worlds: hard on the graphics card.", gpuFps: 85, cpuFps: 110 },
  { id: "rt", label: "Ray-traced adventure", blurb: "The heaviest lighting there is.", gpuFps: 55, cpuFps: 120 },
  { id: "strategy", label: "City builder", blurb: "Thousands of moving parts: a processor game.", gpuFps: 170, cpuFps: 70 },
  { id: "indie", label: "Indie platformer", blurb: "Runs on nearly anything.", gpuFps: 500, cpuFps: 600 },
];

export interface EstimateCell {
  resolution: Resolution;
  fps: number;
  verdict: Verdict;
  limitedBy: "cpu" | "gpu";
}
export interface EstimateRow {
  genre: Genre;
  cells: EstimateCell[];
}

export function verdictFor(fps: number): Verdict {
  return fps < 30 ? "struggles" : fps < 60 ? "playable" : fps < 120 ? "smooth" : "fast";
}

function score(table: Record<string, number>, id: string): number {
  const value = Object.hasOwn(table, id) ? table[id] : undefined;
  if (value === undefined) throw new Error(`No performance score for "${id}"`);
  return value;
}

/** The table for a CPU and a GPU, given by catalogue id. */
export function estimateTable(picks: { cpu: string; gpu: string }): EstimateRow[] {
  const cpu = score(CPU_SCORE, picks.cpu) / 100;
  const gpu = score(GPU_SCORE, picks.gpu) / 100;
  return genres.map((genre) => ({
    genre,
    cells: RESOLUTIONS.map(({ id, cost }) => {
      const fromCpu = cpu * genre.cpuFps;
      const fromGpu = (gpu * genre.gpuFps) / cost;
      const fps = Math.max(1, Math.round(Math.min(fromCpu, fromGpu)));
      return { resolution: id, fps, verdict: verdictFor(fps), limitedBy: fromCpu <= fromGpu ? "cpu" : "gpu" };
    }),
  }));
}
