import { describe, expect, it } from "vitest";
import { getItem } from "./catalogue";
import { pcSidecar } from "./pc";
import { rowFor, sheet, sheetChecks, sheetTotal, specLine, usd } from "./showcase";

describe("the showcase spec sheet", () => {
  it("covers every sidecar part exactly once", () => {
    const covered = sheet.flatMap((r) => r.parts);
    expect(new Set(covered).size).toBe(covered.length);
    expect([...covered].sort()).toEqual(Object.keys(pcSidecar.parts).sort());
  });

  it("passes every compatibility rule", () => {
    const failures = sheetChecks.filter((c) => !c.result.ok).map((c) => c.rule.id);
    expect(failures).toEqual([]);
  });

  it("adds up to the sum of its rows, fans counted twice", () => {
    expect(sheetTotal).toBe(sheet.reduce((s, r) => s + r.item.priceUsd * r.qty, 0));
    expect(sheet.find((r) => r.kind === "fan")!.qty).toBe(2);
  });

  it("finds the row for a part", () => {
    expect(rowFor("ram_3")!.kind).toBe("ram");
    expect(rowFor("cables")!.kind).toBe("psu");
    expect(rowFor("nope")).toBeUndefined();
  });

  it("formats specs the way a configurator does", () => {
    expect(specLine(getItem("ram_pulse_ddr5_64"))).toBe("DDR5 · 4 x 16 GB");
    expect(specLine(getItem("psu_anchor_750"))).toBe("750 W · 80+ Gold");
    expect(specLine(getItem("nvme_flux_g4_2tb"))).toBe("PCIe 4.0 x4 · 2 TB");
    expect(usd(1234)).toBe("$1,234");
  });
});
