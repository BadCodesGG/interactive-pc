import { describe, expect, it } from "vitest";
import { byKind, catalogue, catalogueKinds, type CatalogueKind } from "@/data/catalogue";
import type { Picks } from "@/data/compat";
import { defaultPickIds } from "@/data/showcase";
import { MAX_SHARE_LENGTH, SHARE_PARAM, SLOT_KEYS, decodePicks, encodePicks, initialBuild, shareHref, withDefaults, withSharedPicks } from "./share-build";

const allIds = new Set(catalogue.map((c) => c.id));
const idsOf = (kind: CatalogueKind) => byKind(kind).map((c) => c.id);

/** Every value a decode returned is a catalogue id of the right kind: the whole safety claim. */
function expectAllowListed(out: Partial<Picks>) {
  for (const [kind, id] of Object.entries(out)) {
    expect(catalogueKinds).toContain(kind);
    expect(allIds.has(id as string), `${kind}=${id}`).toBe(true);
    expect(idsOf(kind as CatalogueKind)).toContain(id);
  }
}

describe("the codes are a public contract", () => {
  it("pins each slot's letter", () => {
    expect(SLOT_KEYS).toEqual({ case: "c", motherboard: "m", cpu: "u", cooler: "k", ram: "r", gpu: "g", nvme: "n", ssd: "s", psu: "p", fan: "f" });
    expect(SHARE_PARAM).toBe("b");
  });

  it("pins the catalogue order within each kind, because the index is the code", () => {
    expect(Object.fromEntries(catalogueKinds.map((k) => [k, idsOf(k)]))).toEqual({
      case: ["case_bastion_atx", "case_cube_matx", "case_pocket_itx"],
      motherboard: ["mb_foundry_v700_atx", "mb_foundry_v500_atx", "mb_ridge_v400_matx", "mb_nano_v500_itx"],
      cpu: ["cpu_vertex_8", "cpu_vertex_12_new", "cpu_apex_16", "cpu_ember_6"],
      cooler: ["cooler_zephyr_slim", "cooler_zephyr_tower", "cooler_monolith_dual", "cooler_tidal_240"],
      ram: ["ram_pulse_ddr5_32", "ram_pulse_ddr5_64", "ram_crest_tall", "ram_pulse_ddr4_32"],
      gpu: ["gpu_nova_8", "gpu_nova_12", "gpu_nova_16", "gpu_titan_24"],
      psu: ["psu_anchor_550", "psu_anchor_750", "psu_anchor_1000", "psu_compact_750_sfx"],
      nvme: ["nvme_flux_g4_1tb", "nvme_flux_g4_2tb", "nvme_flux_g5_2tb"],
      ssd: ["ssd_stack_1tb", "ssd_stack_2tb"],
      fan: ["fan_breeze_120", "fan_breeze_120_rgb", "fan_breeze_140"],
    });
  });

  it("fits every kind's list in one base 36 character", () => {
    for (const kind of catalogueKinds) expect(byKind(kind).length, kind).toBeLessThanOrEqual(36);
  });

  it("gives every kind its own letter", () => {
    expect(new Set(Object.values(SLOT_KEYS)).size).toBe(catalogueKinds.length);
  });
});

describe("encode", () => {
  it("writes a slot letter and an index per pick, in catalogue order", () => {
    expect(encodePicks({ case: "case_cube_matx", cpu: "cpu_ember_6" })).toBe("c1u3");
    expect(encodePicks({ fan: "fan_breeze_140", case: "case_bastion_atx" })).toBe("c0f2");
  });

  it("stays compact and inside the decode cap for a full build", () => {
    const code = encodePicks(defaultPickIds);
    expect(code).toHaveLength(catalogueKinds.length * 2);
    expect(code.length).toBeLessThanOrEqual(MAX_SHARE_LENGTH);
    expect(code).toMatch(/^[a-z0-9]+$/);
  });

  it("leaves out an id that is not in that slot's list instead of writing it", () => {
    expect(encodePicks({ cpu: "gpu_nova_8" })).toBe("");
    expect(encodePicks({ cpu: "nope" })).toBe("");
    expect(encodePicks({})).toBe("");
  });
});

describe("round trip", () => {
  it("returns every catalogue id in its own slot", () => {
    for (const item of catalogue) {
      const picks = { ...defaultPickIds, [item.kind]: item.id };
      expect(decodePicks(encodePicks(picks)), item.id).toEqual(picks);
    }
  });

  it("returns the whole shipped build, and a partial one", () => {
    expect(decodePicks(encodePicks(defaultPickIds))).toEqual(defaultPickIds);
    expect(decodePicks(encodePicks({ gpu: "gpu_titan_24" }))).toEqual({ gpu: "gpu_titan_24" });
  });

  it("reads the same code from an array of repeated parameters (the first one)", () => {
    expect(decodePicks(["g3", "g0"])).toEqual({ gpu: "gpu_titan_24" });
  });
});

describe("decode drops what it does not understand, silently", () => {
  it("returns nothing for empty and non-string input", () => {
    for (const raw of [undefined, null, "", 0, 42, true, {}, [], [1, 2], () => "c0", Symbol("c0")]) {
      expect(decodePicks(raw), String(typeof raw)).toEqual({});
    }
  });

  it("drops an unknown slot letter and keeps the valid entries around it", () => {
    expect(decodePicks("x0c1z9g0")).toEqual({ case: "case_cube_matx", gpu: "gpu_nova_8" });
  });

  it("drops an index past the end of the slot's list, even when another slot has that many", () => {
    // The case list has 3 items, the CPU list 4: "3" is valid for a CPU and not for a case.
    expect(decodePicks("c3")).toEqual({});
    expect(decodePicks("u3")).toEqual({ cpu: "cpu_ember_6" });
    expect(decodePicks("s2")).toEqual({});
    expect(decodePicks("cz")).toEqual({});
  });

  it("keeps the first entry for a slot given twice", () => {
    expect(decodePicks("g3g0g1")).toEqual({ gpu: "gpu_titan_24" });
  });

  it("drops a trailing half entry", () => {
    expect(decodePicks("g1c")).toEqual({ gpu: "gpu_nova_12" });
  });

  it("returns nothing for anything outside lowercase letters and digits", () => {
    for (const raw of ["G0", "g 0", "g-0", "g0;", "g0%20", "%67%30", "g0\n", "g0\u0000", "\u{1F680}", "g\u0660", "c0 ", "<b>c0</b>", "<img src=x onerror=alert(1)>", "'; drop table", "a[href]", "#root > div", "javascript:alert(1)"]) {
      expect(decodePicks(raw), JSON.stringify(raw)).toEqual({});
    }
  });

  it("is not fooled by property names that live on every object", () => {
    for (const raw of ["__proto__", "constructor", "prototype", "hasownproperty", "tostring"]) {
      const out = decodePicks(raw);
      expectAllowListed(out);
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns nothing for an oversize parameter, however valid its start", () => {
    const valid = encodePicks(defaultPickIds);
    expect(decodePicks(valid + "g0".repeat(MAX_SHARE_LENGTH))).toEqual({});
    expect(decodePicks("g0".repeat(MAX_SHARE_LENGTH / 2))).toEqual({ gpu: "gpu_nova_8" });
    expect(decodePicks("g0".repeat(MAX_SHARE_LENGTH / 2 + 1))).toEqual({});
    expect(decodePicks("a".repeat(1_000_000))).toEqual({});
  });

  it("never throws, and only ever returns allow-listed ids, for 5000 pseudo-random strings", () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789 -_%<>&'\"\/.:;[]#{}\u0000\u00e9\u{1F680}";
    const chars = [...alphabet];
    for (let i = 0; i < 5000; i++) {
      const len = next() % 90;
      let raw = "";
      for (let j = 0; j < len; j++) raw += chars[next() % chars.length];
      expectAllowListed(decodePicks(raw));
    }
  });

  it("does not echo any of the input into its output", () => {
    const out = decodePicks("g1" + "zz");
    expect(JSON.stringify(out)).toBe('{"gpu":"gpu_nova_12"}');
  });
});

describe("withDefaults", () => {
  it("fills missing slots from the shipped picks and keeps the given ones", () => {
    const full = withDefaults({ gpu: "gpu_titan_24" });
    expect(full).toEqual({ ...defaultPickIds, gpu: "gpu_titan_24" });
    expect(withDefaults({})).toEqual(defaultPickIds);
  });
});

const titan = { ...defaultPickIds, gpu: "gpu_titan_24" };

describe("withSharedPicks (the address bar)", () => {
  it("sets the parameter for a changed build and keeps every other parameter", () => {
    expect(withSharedPicks("", titan)).toBe("?b=" + encodePicks(titan));
    expect(withSharedPicks("?part=cpu&x=1", titan)).toBe("?part=cpu&x=1&b=" + encodePicks(titan));
  });

  it("replaces an earlier value, in place, instead of adding a second", () => {
    expect(withSharedPicks("?b=g0&part=cpu", titan)).toBe("?b=" + encodePicks(titan) + "&part=cpu");
  });

  it("drops the parameter for the shipped build, and leaves an empty search empty", () => {
    expect(withSharedPicks("?b=g3", defaultPickIds)).toBe("");
    expect(withSharedPicks("?part=cpu&b=g3", defaultPickIds)).toBe("?part=cpu");
  });

  it("keeps every other parameter byte for byte, and replaces a percent-encoded key too", () => {
    expect(withSharedPicks("?utm=a%20b&flag&x=1", titan)).toBe("?utm=a%20b&flag&x=1&b=" + encodePicks(titan));
    expect(withSharedPicks("?%62=g0&keep=1", titan)).toBe("?b=" + encodePicks(titan) + "&keep=1");
    expect(withSharedPicks("?%62=g0&keep=1", defaultPickIds)).toBe("?keep=1");
  });

  it("never throws on a strange search string", () => {
    for (const search of ["?", "??", "?%", "?b", "?=&=", "?%E0%A4%A", "?b=%00&b=%ff"]) expect(() => withSharedPicks(search, titan)).not.toThrow();
  });
});

describe("shareHref", () => {
  it("is the page's own address with the build in it, keeping the path, other parameters and the hash", () => {
    const loc = { origin: "https://example.test", pathname: "/build", search: "?utm=1", hash: "#sheet" };
    expect(shareHref(loc, titan)).toBe("https://example.test/build?utm=1&b=" + encodePicks(titan) + "#sheet");
    expect(shareHref({ ...loc, search: "", hash: "" }, defaultPickIds)).toBe("https://example.test/build");
  });

  it("round trips through the decoder", () => {
    const href = new URL(shareHref({ origin: "https://example.test", pathname: "/build", search: "", hash: "" }, titan));
    expect(withDefaults(decodePicks(href.searchParams.get(SHARE_PARAM)))).toEqual(titan);
  });
});

describe("initialBuild (the /build page's reading of its address)", () => {
  it("starts the shipped build in Guided when there is no parameter", () => {
    expect(initialBuild({})).toEqual({ picks: defaultPickIds, mode: "guided", shared: false });
  });

  it("restores a shared build, and opens Free so its rows can be swapped", () => {
    expect(initialBuild({ b: encodePicks(titan) })).toEqual({ picks: titan, mode: "free", shared: true });
  });

  it("restores only the slots it was given", () => {
    expect(initialBuild({ b: "g3" })).toEqual({ picks: titan, mode: "free", shared: true });
  });

  it("stays on the shipped build in Guided when the shared one is the shipped one", () => {
    expect(initialBuild({ b: encodePicks(defaultPickIds) })).toEqual({ picks: defaultPickIds, mode: "guided", shared: false });
  });

  it("falls back to the default, silently, for a bad or tampered parameter", () => {
    const fallback = { picks: defaultPickIds, mode: "guided", shared: false };
    for (const b of ["", "!!", "G3", "g3<script>", "g3;drop", "zz", "__proto__", "g9", "c3", "%67%33", "a".repeat(5000), "g3 ", " ", [], [""]]) {
      expect(initialBuild({ b }), JSON.stringify(b)).toEqual(fallback);
    }
  });

  it("ignores every other parameter, and a value that is not a string", () => {
    expect(initialBuild({ part: "cpu", mode: "speedrun", b: undefined })).toEqual({ picks: defaultPickIds, mode: "guided", shared: false });
    expect(initialBuild({ b: 5 as unknown as string })).toEqual({ picks: defaultPickIds, mode: "guided", shared: false });
  });

  it("keeps the good part of a parameter with a stray entry in it", () => {
    // Entries are read in pairs: the bad slot letter is dropped, the valid one is kept.
    expect(initialBuild({ b: "x0g3" }).picks.gpu).toBe("gpu_titan_24");
  });

  it("only ever returns catalogue ids, whatever it was given", () => {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    const chars = [..."abcdefghijklmnopqrstuvwxyz0123456789<>&'\"%;"];
    for (let i = 0; i < 2000; i++) {
      let b = "";
      for (let j = next() % 50; j > 0; j--) b += chars[next() % chars.length];
      const { picks } = initialBuild({ b });
      for (const id of Object.values(picks)) expect(allIds.has(id)).toBe(true);
    }
  });
});
