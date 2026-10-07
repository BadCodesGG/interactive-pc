import { describe, expect, it } from "vitest";
import { byKind, catalogueKinds, getItem, type CatalogueKind } from "./catalogue";
import { COMPAT_EXCLUDED_RULES, RULE_KINDS, STATUS_LABEL, buildFor, compatReport, type Picks } from "./compat";
import { defaultPickIds } from "./showcase";
import { rules } from "./rules";

const base = (over: Partial<Record<CatalogueKind, string>> = {}): Picks => ({ ...defaultPickIds, ...over });

describe("the shipped picks", () => {
  it("fit on every row with no failing check", () => {
    const r = compatReport(base());
    for (const kind of catalogueKinds) expect(r.rows[kind].status, kind).toBe("fits");
    expect(r.overall).toBe("fits");
    expect(r.failing).toEqual([]);
    expect(r.passed).toBe(r.total);
  });

  it("gives a Fits row a short reason that counts its checks", () => {
    const r = compatReport(base());
    expect(r.rows.gpu.reason).toBe("Passes 1 check.");
    expect(r.rows.case.reason).toBe("Passes 3 checks.");
  });
});

describe("a blocking rule", () => {
  it("marks both parts the rule names as Won't fit, with the rule's reason", () => {
    const r = compatReport(base({ cooler: "cooler_zephyr_slim" }));
    expect(r.rows.cooler.status).toBe("wont-fit");
    expect(r.rows.cooler.reason).toContain("no bracket for the S-Beta socket");
    expect(r.rows.cpu.status).toBe("wont-fit");
    expect(r.rows.cpu.ruleIds).toEqual(["cooler_socket_tdp"]);
    expect(r.rows.gpu.status).toBe("fits");
    expect(r.overall).toBe("wont-fit");
  });

  it("flags a DDR4 kit on the DDR5 board, on the memory and board rows", () => {
    const r = compatReport(base({ ram: "ram_pulse_ddr4_32" }));
    expect(r.rows.ram.status).toBe("wont-fit");
    expect(r.rows.motherboard.status).toBe("wont-fit");
    expect(r.rows.ram.reason).toMatch(/DDR4/);
  });

  it("does not put a power supply shortfall on the CPU, GPU or board rows", () => {
    const r = compatReport(base({ gpu: "gpu_titan_24", psu: "psu_anchor_550" }));
    expect(r.rows.psu.status).toBe("wont-fit");
    expect(r.rows.psu.reason).toMatch(/at least/);
    expect(r.rows.gpu.status).toBe("fits");
    expect(r.rows.cpu.status).toBe("fits");
  });
});

describe("a warning rule", () => {
  it("marks a tower rated below the CPU as Check, not Won't fit", () => {
    const r = compatReport(base({ cpu: "cpu_apex_16" }));
    expect(r.rows.cooler.status).toBe("check");
    expect(r.rows.cooler.reason).toMatch(/throttle/);
    expect(r.rows.cpu.status).toBe("check");
    expect(r.overall).toBe("check");
  });

  it("lets a block beat a warning on the same row", () => {
    const r = compatReport(base({ cpu: "cpu_apex_16", cooler: "cooler_zephyr_slim" }));
    expect(r.rows.cooler.status).toBe("wont-fit");
  });
});

describe("the BIOS trap and tall memory", () => {
  it("catches the new-gen CPU on the old-BIOS board", () => {
    const r = compatReport(base({ cpu: "cpu_vertex_12_new", motherboard: "mb_foundry_v500_atx" }));
    expect(r.rows.cpu.status).toBe("wont-fit");
    expect(r.rows.cpu.reason).toMatch(/BIOS flash/);
  });

  it("catches tall memory under an air tower, and hides that rule when asked", () => {
    const tall = base({ ram: "ram_crest_tall" });
    expect(compatReport(tall).rows.ram.status).toBe("wont-fit");
    const hidden = compatReport(tall, { hiddenRuleIds: ["ram_tower_clearance"] });
    expect(hidden.rows.ram.status).toBe("fits");
    expect(hidden.total).toBe(compatReport(tall).total - 1);
  });
});

describe("kind swaps that change the kit, not the placement", () => {
  it("does not count placed parts (a 2-stick kit on a finished build is fine)", () => {
    const r = compatReport(base({ ram: "ram_pulse_ddr5_32" }));
    expect(r.rows.ram.status).toBe("fits");
  });

  it("checks the case against the board, the card and the supply", () => {
    const r = compatReport(base({ case: "case_pocket_itx" }));
    expect(r.rows.case.status).toBe("wont-fit");
    for (const k of ["motherboard", "gpu", "cooler"] as const) expect(r.rows[k].status, k).toBe("wont-fit");
  });
});

describe("the rule to row map", () => {
  it("covers every rule, either mapped or explicitly excluded, so a new rule cannot vanish", () => {
    for (const rule of rules) {
      const mapped = rule.id in RULE_KINDS;
      const excluded = COMPAT_EXCLUDED_RULES.includes(rule.id);
      expect(mapped !== excluded, rule.id).toBe(true);
    }
  });

  it("only maps to real kinds and real rules", () => {
    const ids = rules.map((r) => r.id);
    for (const [id, kinds] of Object.entries(RULE_KINDS)) {
      expect(ids, id).toContain(id);
      for (const k of kinds) expect(catalogueKinds).toContain(k);
    }
  });
});

describe("buildFor", () => {
  it("resolves ids to items and never reads the placement order", () => {
    const b = buildFor(base());
    expect(b.placed).toEqual([]);
    expect(b.gpu).toBe(getItem(defaultPickIds.gpu));
  });
});

describe("status labels", () => {
  it("uses the words the sheet shows", () => {
    expect(STATUS_LABEL).toEqual({ fits: "Fits", check: "Check", "wont-fit": "Won't fit" });
  });
});

describe("every catalogue alternative", () => {
  it("yields a defined status and reason on every row, without throwing", () => {
    for (const kind of catalogueKinds) {
      for (const item of byKind(kind)) {
        const r = compatReport(base({ [kind]: item.id }));
        for (const k of catalogueKinds) {
          expect(["fits", "check", "wont-fit"]).toContain(r.rows[k].status);
          expect(r.rows[k].reason.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
