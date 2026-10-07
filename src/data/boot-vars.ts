/** The numbers on the power-on boot screen, from the picked parts: temperatures from the heat map, the benchmark from the estimate table. */
import { getItem } from "./catalogue";
import type { Picks } from "./compat";
import { estimateTable } from "./run-estimate";
import { thermalMap } from "./thermal";

const AMBIENT_C = 25;
const SPAN_C = 55;

export function bootVarsFor(picks: Picks): Record<string, string | number> {
  const cpu = getItem(picks.cpu);
  const { heat } = thermalMap(picks);
  const openWorld = estimateTable({ cpu: picks.cpu, gpu: picks.gpu }).find((r) => r.genre.id === "openworld");
  return {
    cpu: cpu.name,
    cores: Number(cpu.spec.cores),
    // The boot line counts memory in MB.
    ramGb: Number(getItem(picks.ram).spec.gb) * 1024,
    gpu: getItem(picks.gpu).name,
    nvme: getItem(picks.nvme).name,
    cpuTemp: Math.round(AMBIENT_C + heat.cpu * SPAN_C),
    gpuTemp: Math.round(AMBIENT_C + heat.gpu * SPAN_C),
    fps: openWorld?.cells.find((c) => c.resolution === "1440p")?.fps ?? 0,
  };
}
