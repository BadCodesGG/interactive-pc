import { describe, expect, it } from "vitest";
import { renderBootScreen } from "./assembly";
import { bootVarsFor } from "./boot-vars";
import { defaultPickIds } from "./showcase";

describe("bootVarsFor", () => {
  it("reads the shipped build's parts off the catalogue", () => {
    const v = bootVarsFor(defaultPickIds);
    expect(v.cpu).toBe("Vertex 8-core");
    expect(v.cores).toBe(8);
    expect(v.gpu).toBe("Nova 16 GB");
    expect(v.nvme).toBe("Flux Gen4 2 TB");
    // 64 GB of memory, as the boot line counts it (MB).
    expect(v.ramGb).toBe(65536);
  });

  it("puts temperatures from the heat map on the screen: 25 C plus 55 C of the part's heat", () => {
    // Worked by hand in thermal.test.ts: CPU 0.583, GPU 0.555 of the way up.
    const v = bootVarsFor(defaultPickIds);
    expect(v.cpuTemp).toBe(57);
    expect(v.gpuTemp).toBe(56);
  });

  it("puts the open-world 1440p estimate on the screen as the benchmark result", () => {
    // 1.9 x 85 / 1.8 = 89.7 from the card, 110 from the CPU.
    expect(bootVarsFor(defaultPickIds).fps).toBe(90);
  });

  it("fills every placeholder of the boot screen, leaving none visible", () => {
    const lines = renderBootScreen(bootVarsFor(defaultPickIds));
    expect(lines.join("\n")).not.toMatch(/\{\w+\}/);
    expect(lines.some((l) => l.includes("Vertex 8-core"))).toBe(true);
  });

  it("follows the picks", () => {
    const hot = bootVarsFor({ ...defaultPickIds, gpu: "gpu_titan_24" });
    expect(hot.gpuTemp).toBeGreaterThan(bootVarsFor(defaultPickIds).gpuTemp as number);
    expect(hot.gpu).toBe("Titan 24 GB");
  });
});
