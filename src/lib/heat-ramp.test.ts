import { describe, expect, it } from "vitest";
import { HEAT_AMOUNT, HEAT_BAND, HEAT_STOPS, heatColor, heatGradient, heatLooks, onlyInstalled, rampPosition } from "./heat-ramp";

const HEX = /^#[0-9a-f]{6}$/;

describe("heatColor", () => {
  it("is the cool stop at 0, the middle stop at 0.5 and the hot stop at 1, in each theme", () => {
    for (const theme of ["light", "dark"] as const) {
      const [cool, mid, hot] = HEAT_STOPS[theme];
      expect(heatColor(0, theme)).toBe(cool);
      expect(heatColor(0.5, theme)).toBe(mid);
      expect(heatColor(1, theme)).toBe(hot);
    }
  });

  it("blends between stops, halfway between cool and middle at 0.25", () => {
    // Light: #2f6fb5 and #e8a13a, halfway: (47+232)/2 = 139.5 -> 8c, (111+161)/2 = 136 -> 88, (181+58)/2 = 119.5 -> 78.
    expect(HEAT_STOPS.light[0]).toBe("#2f6fb5");
    expect(HEAT_STOPS.light[1]).toBe("#e8a13a");
    expect(heatColor(0.25, "light")).toBe("#8c8878");
  });

  it("clamps outside 0 to 1 and treats a number that is not one as cool", () => {
    expect(heatColor(-3, "dark")).toBe(HEAT_STOPS.dark[0]);
    expect(heatColor(9, "dark")).toBe(HEAT_STOPS.dark[2]);
    expect(heatColor(NaN, "dark")).toBe(HEAT_STOPS.dark[0]);
  });

  it("always answers a six digit hex colour", () => {
    for (let i = 0; i <= 100; i++) for (const theme of ["light", "dark"] as const) expect(heatColor(i / 100, theme)).toMatch(HEX);
  });

  it("uses different colours in light and dark, both ramps ending on red", () => {
    expect(HEAT_STOPS.light).not.toEqual(HEAT_STOPS.dark);
    for (const theme of ["light", "dark"] as const) for (const c of HEAT_STOPS[theme]) expect(c).toMatch(HEX);
    for (const theme of ["light", "dark"] as const) {
      const hot = HEAT_STOPS[theme][2];
      const r = parseInt(hot.slice(1, 3), 16);
      const g = parseInt(hot.slice(3, 5), 16);
      expect(r).toBeGreaterThan(g * 2);
    }
  });
});

describe("heatLooks", () => {
  it("tints only the parts that make heat, more strongly the hotter they are", () => {
    const looks = heatLooks({ cpu: 0.3, gpu: 0.7, case_frame: 0, fan_front: 0 }, "light");
    expect(Object.keys(looks.parts).sort()).toEqual(["cpu", "gpu"]);
    expect(looks.parts.gpu.amount).toBeGreaterThan(looks.parts.cpu.amount!);
    expect(looks.parts.cpu.tint).toBe(heatColor(rampPosition(0.3), "light"));
  });

  it("keeps the blend inside the set range, so a cool part is still seen and a hot one still shows its shape", () => {
    const looks = heatLooks({ a: 0.001, b: 1, c: 5 }, "dark");
    for (const p of Object.values(looks.parts)) {
      expect(p.amount).toBeGreaterThanOrEqual(HEAT_AMOUNT.min);
      expect(p.amount).toBeLessThanOrEqual(HEAT_AMOUNT.max);
    }
    expect(looks.parts.b.amount).toBe(HEAT_AMOUNT.max);
  });

  it("spreads the ramp over the band the parts actually sit in, so they do not all read as one colour", () => {
    expect(rampPosition(HEAT_BAND.from)).toBe(0);
    expect(rampPosition(HEAT_BAND.to)).toBe(1);
    expect(rampPosition(0)).toBe(0);
    expect(rampPosition(1)).toBe(1);
    expect(rampPosition((HEAT_BAND.from + HEAT_BAND.to) / 2)).toBeCloseTo(0.5, 10);
    // Two parts 0.25 apart (the SSD and the GPU on the shipped build) end up more than 0.4 apart on the ramp.
    expect(rampPosition(0.55) - rampPosition(0.31)).toBeGreaterThan(0.4);
  });

  it("follows the theme", () => {
    expect(heatLooks({ cpu: 0.9 }, "light").parts.cpu.tint).not.toBe(heatLooks({ cpu: 0.9 }, "dark").parts.cpu.tint);
  });

  it("returns no looks for a model with no heat, and never scales a part", () => {
    expect(heatLooks({}, "light").parts).toEqual({});
    expect(heatLooks({ cpu: 0.5 }, "light").parts.cpu.scale).toBeUndefined();
  });
});

describe("heatGradient", () => {
  it("is a left to right CSS gradient through the theme's three stops", () => {
    const g = heatGradient("dark");
    expect(g.startsWith("linear-gradient(to right")).toBe(true);
    for (const c of HEAT_STOPS.dark) expect(g).toContain(c);
  });
});

describe("onlyInstalled", () => {
  it("keeps the heat of installed parts and drops the rest, so a loose part keeps its own look", () => {
    const heat = { cpu: 0.6, gpu: 0.5, psu: 0.4 };
    expect(onlyInstalled(heat, new Set(["cpu", "psu"]))).toEqual({ cpu: 0.6, psu: 0.4 });
    expect(Object.keys(heatLooks(onlyInstalled(heat, new Set(["cpu"])), "light").parts)).toEqual(["cpu"]);
  });

  it("drops everything when nothing is installed, and keeps everything when there is no filter", () => {
    expect(onlyInstalled({ cpu: 0.6 }, new Set())).toEqual({});
    expect(onlyInstalled({ cpu: 0.6 }, null)).toEqual({ cpu: 0.6 });
  });

  it("ignores installed ids that make no heat", () => {
    expect(onlyInstalled({ cpu: 0.6 }, new Set(["cpu", "case_frame"]))).toEqual({ cpu: 0.6 });
  });
});
