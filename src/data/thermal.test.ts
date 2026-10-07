import { describe, expect, it } from "vitest";
import { byKind } from "./catalogue";
import type { Picks } from "./compat";
import { pcSidecar } from "./pc";
import { defaultPickIds } from "./showcase";
import { FAN_CFM, airflowCfm, thermalMap } from "./thermal";

const picks = (over: Partial<Picks> = {}): Picks => ({ ...defaultPickIds, ...over });
const partIds = Object.keys(pcSidecar.parts);

describe("airflow", () => {
  it("is the smaller of intake and exhaust, for the usual front-in rear-out pair", () => {
    // Two 120 mm fans at 55 CFM each: 55 in, 55 out.
    expect(airflowCfm(picks())).toBe(55);
    expect(FAN_CFM[120]).toBe(55);
  });

  it("is bigger for 140 mm fans", () => {
    expect(airflowCfm(picks({ fan: "fan_breeze_140" }))).toBe(FAN_CFM[140]);
    expect(FAN_CFM[140]).toBeGreaterThan(FAN_CFM[120]);
  });

  it("drops when both fans blow the same way, but the fans still move some air", () => {
    const both = airflowCfm(picks(), { front: "intake", rear: "intake" });
    // No exhaust: min(110, 0) + 0.35 x 110 = 38.5.
    expect(both).toBeCloseTo(38.5, 5);
    expect(both).toBeLessThan(airflowCfm(picks()));
    expect(both).toBeGreaterThan(0);
  });
});

describe("the heat map", () => {
  it("is keyed by the sidecar's part ids and stays between 0 and 1", () => {
    const { heat } = thermalMap(picks());
    for (const id of Object.keys(heat)) expect(partIds, id).toContain(id);
    for (const id of partIds) {
      expect(heat[id], id).toBeGreaterThanOrEqual(0);
      expect(heat[id], id).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(heat).sort()).toEqual([...partIds].sort());
  });

  it("matches the worked example for the shipped build", () => {
    // Airflow 55 CFM: relief 55 / (55 + 60) = 0.4783, factor 1 - 0.35 x 0.4783 = 0.8326.
    // CPU: 105 W on a 150 W cooler = 0.7 x 0.8326 = 0.583. GPU: 300 W of 450 W = 0.667 x 0.8326 = 0.555.
    const { heat, throttling } = thermalMap(picks());
    expect(heat.cpu).toBeCloseTo(0.583, 3);
    expect(heat.gpu).toBeCloseTo(0.555, 3);
    expect(throttling).toBe(false);
  });

  it("leaves parts that make no heat at 0", () => {
    const { heat } = thermalMap(picks());
    for (const id of ["case_frame", "panel_left", "panel_right", "panel_front", "fan_front", "fan_rear", "cables"]) expect(heat[id], id).toBe(0);
  });

  it("makes the heat-making parts warm", () => {
    const { heat } = thermalMap(picks());
    for (const id of ["cpu", "cooler", "gpu", "motherboard", "psu", "nvme", "ssd_sata", "ram_2", "ram_4"]) expect(heat[id], id).toBeGreaterThan(0);
  });

  it("heats the GPU more as its TDP goes up, and leaves the CPU alone", () => {
    const small = thermalMap(picks({ gpu: "gpu_nova_8" })).heat;
    const big = thermalMap(picks({ gpu: "gpu_titan_24" })).heat;
    expect(big.gpu).toBeGreaterThan(small.gpu);
    expect(big.cpu).toBe(small.cpu);
  });

  it("heats everything less with more airflow", () => {
    const slow = thermalMap(picks({ fan: "fan_breeze_120" })).heat;
    const fast = thermalMap(picks({ fan: "fan_breeze_140" })).heat;
    for (const id of ["cpu", "gpu", "motherboard", "psu", "nvme", "ram_2"]) expect(fast[id], id).toBeLessThan(slow[id]);
  });

  it("heats everything more when both fans blow the same way", () => {
    const good = thermalMap(picks()).heat;
    const same = thermalMap(picks(), { front: "intake", rear: "intake" }).heat;
    expect(same.cpu).toBeGreaterThan(good.cpu);
    expect(same.gpu).toBeGreaterThan(good.gpu);
  });

  it("makes the CPU and cooler hotter on a weaker cooler, and flags throttling past its rating", () => {
    // The 170 W CPU is over the 150 W tower's rating and under the 250 W liquid cooler's.
    const tower = thermalMap(picks({ cpu: "cpu_apex_16" }));
    const liquid = thermalMap(picks({ cpu: "cpu_apex_16", cooler: "cooler_tidal_240" }));
    expect(tower.throttling).toBe(true);
    expect(liquid.throttling).toBe(false);
    expect(tower.heat.cpu).toBeGreaterThan(liquid.heat.cpu);
    expect(tower.heat.cooler).toBeGreaterThan(liquid.heat.cooler);
  });

  it("clamps at 1 instead of running past it", () => {
    const { heat } = thermalMap(picks({ cpu: "cpu_apex_16", cooler: "cooler_zephyr_slim", gpu: "gpu_titan_24" }), { front: "intake", rear: "intake" });
    expect(heat.cpu).toBe(1);
    expect(Math.max(...Object.values(heat))).toBeLessThanOrEqual(1);
  });

  it("populates two memory slots for a 2-stick kit and four for a 4-stick kit", () => {
    const two = thermalMap(picks({ ram: "ram_pulse_ddr5_32" })).heat;
    expect([two.ram_1, two.ram_3]).toEqual([0, 0]);
    expect(two.ram_2).toBeGreaterThan(0);
    expect(two.ram_4).toBeGreaterThan(0);
    const four = thermalMap(picks()).heat;
    for (const id of ["ram_1", "ram_2", "ram_3", "ram_4"]) expect(four[id], id).toBeGreaterThan(0);
  });

  it("runs a better-rated supply cooler, because it wastes less", () => {
    const bronze = thermalMap(picks({ psu: "psu_anchor_550" })).heat.psu;
    const platinum = thermalMap(picks({ psu: "psu_anchor_1000" })).heat.psu;
    expect(platinum).toBeLessThan(bronze);
  });

  it("returns a finite number for every part of every catalogue alternative", () => {
    for (const kind of ["case", "motherboard", "cpu", "cooler", "ram", "gpu", "psu", "nvme", "ssd", "fan"] as const) {
      for (const item of byKind(kind)) {
        for (const [id, v] of Object.entries(thermalMap(picks({ [kind]: item.id })).heat)) {
          expect(Number.isFinite(v) && v >= 0 && v <= 1, `${item.id} ${id}`).toBe(true);
        }
      }
    }
  });
});
