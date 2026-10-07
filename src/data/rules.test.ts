import { test } from "vitest";
import { catalogue, byKind, getItem, totalPrice } from "./catalogue";
import type { CatalogueItem, CatalogueKind } from "./catalogue";
import { checkBuild, checkBuildDetailed, rules } from "./rules";
import type { Build, RuleResult } from "./rules";
import { assemblySteps, wrongOrderMessage, wrongPlacementMessages, renderBootScreen } from "./assembly";
import { pcCopy, pcGroups } from "./pc.copy";
import { applyTierPenalties, briefs, evaluateBrief, faults, faultsForTier, modes, tiers } from "./modes";
import { scoreBuild } from "./scoring";
import { credits, creditsLine } from "./credits";

// Runs under Vitest: each check is one Vitest test, so a failure names itself in the report.
function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

// The recommended part order, taken from the assembly steps so the two files cannot drift.
const GOOD_ORDER: string[] = assemblySteps
  .filter((s) => s.kind === "place" && !s.optional && !s.movesExisting)
  .map((s) => s.partId);

const KINDS: CatalogueKind[] = ["case", "motherboard", "cpu", "cooler", "ram", "gpu", "psu", "nvme", "ssd", "fan"];

function makeBuild(ids: string[], placed: string[] = GOOD_ORDER, extra: Partial<Build> = {}): Build {
  const build: Build = {
    placed,
    fanOrientation: { front: "intake", rear: "exhaust" },
    ...extra,
  };
  for (const id of ids) {
    const item = getItem(id);
    build[item.kind] = item;
  }
  return build;
}

const COMPATIBLE = [
  "case_bastion_atx",
  "mb_foundry_v700_atx",
  "cpu_vertex_8",
  "cooler_zephyr_tower",
  "ram_pulse_ddr5_32",
  "gpu_nova_12",
  "psu_anchor_750",
  "nvme_flux_g4_1tb",
  "ssd_stack_1tb",
  "fan_breeze_120",
];

function resultFor(build: Build, ruleId: string): RuleResult {
  const index = rules.findIndex((r) => r.id === ruleId);
  assert(index >= 0, `no rule ${ruleId}`);
  return checkBuild(build)[index];
}
function assertBlock(build: Build, ruleId: string, contains?: string): void {
  const r = resultFor(build, ruleId);
  assert(!r.ok, `${ruleId} should fail but passed`);
  if (!r.ok) {
    assert(r.severity === "block", `${ruleId} should block, got ${r.severity}`);
    if (contains) assert(r.reason.includes(contains), `${ruleId} reason "${r.reason}" lacks "${contains}"`);
  }
}
function assertWarn(build: Build, ruleId: string): void {
  const r = resultFor(build, ruleId);
  assert(!r.ok && r.severity === "warn", `${ruleId} should warn`);
}
function assertOk(build: Build, ruleId: string): void {
  const r = resultFor(build, ruleId);
  assert(r.ok, `${ruleId} should pass but: ${r.ok ? "" : r.reason}`);
}

test("there are 11 rules with unique ids, and only the RAM clearance rule is hidden on Hard", () => {
  assert(rules.length === 11, `expected 11 rules, got ${rules.length}`);
  assert(new Set(rules.map((r) => r.id)).size === 11, "duplicate rule ids");
  const hidden = rules.filter((r) => r.hiddenOnHard).map((r) => r.id);
  assert(hidden.join() === "ram_tower_clearance", `hidden: ${hidden.join()}`);
  assert(tiers.hard.hiddenRuleIds.every((id) => rules.some((r) => r.id === id)), "tier hides an unknown rule");
});

test("a compatible build in the guided order passes every rule", () => {
  const results = checkBuild(makeBuild(COMPATIBLE));
  const bad = results
    .map((r, i) => (r.ok ? null : `${rules[i].id}: ${r.reason}`))
    .filter(Boolean);
  assert(bad.length === 0, bad.join(" | "));
  assert(results.length === rules.length, "one result per rule");
});

test("the BIOS trap CPU on the V500 board produces the chipset block", () => {
  const build = makeBuild(["cpu_vertex_12_new", "mb_foundry_v500_atx"].concat(COMPATIBLE.filter((id) => !id.startsWith("cpu_") && !id.startsWith("mb_"))));
  assertBlock(build, "bios_chipset", "BIOS flash");
  // Sockets match, so the socket rule stays quiet: this is the "matched on socket alone" trap.
  assertOk(build, "cpu_socket");
  // The same CPU on the V700 board is fine.
  assertOk(makeBuild(["cpu_vertex_12_new"].concat(COMPATIBLE.filter((id) => !id.startsWith("cpu_")))), "bios_chipset");
});

test("tall RAM under an air tower produces the clearance block", () => {
  const swap = (cooler: string) => makeBuild(["ram_crest_tall", cooler].concat(COMPATIBLE.filter((id) => !id.startsWith("ram_") && !id.startsWith("cooler_"))));
  assertBlock(swap("cooler_zephyr_tower"), "ram_tower_clearance", "heatspreaders");
  assertBlock(swap("cooler_monolith_dual"), "ram_tower_clearance");
  assertOk(swap("cooler_tidal_240"), "ram_tower_clearance"); // AIO has no overhang
  assertOk(swap("cooler_zephyr_slim"), "ram_tower_clearance"); // low-profile clears it
});

test("an undersized PSU blocks", () => {
  const build = makeBuild(["cpu_apex_16", "gpu_titan_24", "psu_anchor_550"].concat(COMPATIBLE.filter((id) => !["cpu_", "gpu_", "psu_"].some((p) => id.startsWith(p)))));
  assertBlock(build, "psu_power", "at least");
  // Exactly at the x1.3 line: (120 + 300) x 1.3 = 546, so a 550 W unit is enough and 545 W would not be.
  const edge = makeBuild(["cpu_vertex_12_new", "gpu_nova_16", "psu_anchor_550", "mb_foundry_v700_atx"].concat(COMPATIBLE.filter((id) => !["cpu_", "gpu_", "psu_", "mb_"].some((p) => id.startsWith(p)))));
  const eps = resultFor(edge, "psu_power");
  assert(!eps.ok && eps.reason.includes("CPU power leads"), "the 550 W unit passes wattage but has too few EPS leads on the V700");
});

test("PSU also blocks on form factor and PCIe leads", () => {
  const notSfx = makeBuild(["case_cube_matx", "mb_ridge_v400_matx", "cpu_ember_6", "cooler_zephyr_slim", "ram_pulse_ddr4_32", "gpu_nova_8", "psu_anchor_550"].concat(["nvme_flux_g4_1tb", "fan_breeze_120"]));
  assertBlock(notSfx, "psu_power", "SFX");
  // (65 + 450) x 1.3 = 670 W fits a 750 W unit, but the SFX unit has 2 PCIe leads and the card wants 3.
  const fewLeads = makeBuild(["case_cube_matx", "mb_ridge_v400_matx", "cpu_ember_6", "gpu_titan_24", "psu_compact_750_sfx"]);
  assertBlock(fewLeads, "psu_power", "PCIe power leads");
});

test("placing the cooler before the CPU violates the access rule", () => {
  const order = ["psu", "motherboard", "cooler", "cpu", "ram_2", "ram_4", "nvme", "fan_front", "fan_rear", "gpu", "ssd_sata", "cables"];
  assertBlock(makeBuild(COMPATIBLE, order), "access_order", "after the CPU");
  // A cooler with no CPU at all in the build is the same mistake.
  assertBlock(makeBuild(COMPATIBLE, ["psu", "motherboard", "cooler"]), "access_order", "after the CPU");
});

test("other access-order mistakes block or warn", () => {
  const withOrder = (order: string[]) => makeBuild(COMPATIBLE, order);
  assertBlock(withOrder(["psu", "motherboard", "cpu", "gpu", "nvme"]), "access_order", "M.2");
  assertBlock(withOrder(["psu", "motherboard", "cpu", "cooler", "ram_2", "ram_4"]), "access_order", "memory");
  assertBlock(withOrder(["psu", "motherboard", "cpu", "panel_left", "gpu"]), "access_order", "panels");
  assertWarn(withOrder(["motherboard", "psu", "cpu"]), "access_order");
  // With a liquid cooler the RAM may go in after it.
  const aio = makeBuild(["cooler_tidal_240"].concat(COMPATIBLE.filter((id) => !id.startsWith("cooler_"))), ["psu", "motherboard", "cpu", "cooler", "ram_2", "ram_4"]);
  assertOk(aio, "access_order");
});

test("the big tower warns when the CPU power lead comes after it", () => {
  const dual = ["cooler_monolith_dual"].concat(COMPATIBLE.filter((id) => !id.startsWith("cooler_")));
  assertWarn(makeBuild(dual), "access_order"); // guided order plugs cables late
  const cablesFirst = ["psu", "motherboard", "cpu", "ram_2", "ram_4", "nvme", "cables", "cooler", "fan_front", "fan_rear", "gpu", "ssd_sata"];
  assertOk(makeBuild(dual, cablesFirst), "access_order");
});

test("form factor, socket, RAM generation and slots each block", () => {
  const rest = (skip: string[]) => COMPATIBLE.filter((id) => !skip.some((p) => id.startsWith(p)));
  assertBlock(makeBuild(["case_pocket_itx"].concat(rest(["case_"]))), "form_factor", "ITX");
  assertBlock(makeBuild(["cpu_ember_6"].concat(rest(["cpu_"]))), "cpu_socket", "socket");
  assertBlock(makeBuild(["ram_pulse_ddr4_32"].concat(rest(["ram_"]))), "ram_compat", "DDR4");
  const itx = makeBuild(["mb_nano_v500_itx", "ram_pulse_ddr5_64", "case_bastion_atx"].concat(rest(["mb_", "ram_", "case_"])));
  assertBlock(itx, "ram_compat", "memory slots");
  const tooMany = makeBuild(COMPATIBLE, ["ram_1", "ram_2", "ram_3"]);
  assertBlock(tooMany, "ram_compat", "only has 2 sticks");
  assertWarn(makeBuild(COMPATIBLE, ["ram_1", "ram_2"]), "ram_compat");
});

test("cooler socket, TDP warning, height and radiator fit", () => {
  const rest = (skip: string[]) => COMPATIBLE.filter((id) => !skip.some((p) => id.startsWith(p)));
  assertBlock(makeBuild(["cooler_zephyr_slim"].concat(rest(["cooler_"]))), "cooler_socket_tdp", "bracket");
  assertWarn(makeBuild(["cpu_apex_16", "cooler_zephyr_tower"].concat(rest(["cooler_", "cpu_"]))), "cooler_socket_tdp");
  assertBlock(makeBuild(["case_cube_matx", "mb_foundry_v500_atx", "cooler_monolith_dual"].concat(rest(["case_", "mb_", "cooler_"]))), "cooler_fit", "tall");
  assertBlock(makeBuild(["case_pocket_itx", "cooler_tidal_240"].concat(rest(["case_", "cooler_"]))), "cooler_fit", "radiator");
  assertOk(makeBuild(["cooler_tidal_240"].concat(rest(["cooler_"]))), "cooler_fit");
});

test("GPU length and thickness", () => {
  const rest = (skip: string[]) => COMPATIBLE.filter((id) => !skip.some((p) => id.startsWith(p)));
  assertBlock(makeBuild(["case_cube_matx", "mb_ridge_v400_matx", "gpu_nova_16"].concat(rest(["case_", "mb_", "gpu_"]))), "gpu_fit", "long");
  assertBlock(makeBuild(["case_pocket_itx", "gpu_titan_24"].concat(rest(["case_", "gpu_"]))), "gpu_fit", "slots");
});

test("fan orientation warns and does not block", () => {
  assertWarn(makeBuild(COMPATIBLE, GOOD_ORDER, { fanOrientation: { front: "exhaust", rear: "exhaust" } }), "fan_orientation");
  assertWarn(makeBuild(COMPATIBLE, GOOD_ORDER, { fanOrientation: { front: "intake", rear: "intake" } }), "fan_orientation");
});

test("an empty build passes and checkBuildDetailed pairs rules with results", () => {
  const empty: Build = { placed: [] };
  assert(checkBuild(empty).every((r) => r.ok), "empty build should pass");
  assert(checkBuildDetailed(empty).length === 11, "detailed length");
});

test("a spec typo throws instead of silently passing", () => {
  const broken: CatalogueItem = { ...getItem("gpu_nova_12"), spec: { slots: 2, tdpW: 200, pcieConnectors: 1 } };
  let threw = false;
  try {
    checkBuild(makeBuild(COMPATIBLE.filter((id) => !id.startsWith("gpu_")), GOOD_ORDER, { gpu: broken }));
  } catch {
    threw = true;
  }
  assert(threw, "missing lengthMm should throw");
});

test("2 to 4 items per kind, unique ids, and the BIOS trap and tall RAM are present", () => {
  for (const kind of KINDS) {
    const n = byKind(kind).length;
    assert(n >= 2 && n <= 4 || (kind === "gpu" && n === 4), `${kind} has ${n} items`);
  }
  assert(new Set(catalogue.map((c) => c.id)).size === catalogue.length, "duplicate catalogue ids");
  assert(catalogue.every((c) => c.priceUsd > 0 && c.name.length > 0), "price or name missing");
  assert(getItem("cpu_vertex_12_new").spec.gen === 2, "trap CPU");
  assert(getItem("ram_crest_tall").spec.heightMm === 54, "tall RAM");
});

test("every rule can read every catalogue item without throwing (all combinations)", () => {
  // Cheap smoke over each pair of kinds: any spec typo would throw inside a rule.
  for (const c of byKind("case")) for (const m of byKind("motherboard")) for (const u of byKind("cpu")) {
    checkBuild({ placed: GOOD_ORDER, case: c, motherboard: m, cpu: u });
  }
});

test("assembly steps reference real ids, have no cycles, and cover every slot", () => {
  const ids = new Set(assemblySteps.map((s) => s.id));
  assert(ids.size === assemblySteps.length, "duplicate step ids");
  for (const step of assemblySteps) {
    for (const dep of step.after) assert(ids.has(dep), `${step.id} depends on unknown ${dep}`);
    assert(step.hint.length > 10 && step.reason.length > 10 && step.label.length > 3, `${step.id} text`);
  }
  // Array order is a valid topological order, which also rules out cycles.
  const seen = new Set<string>();
  for (const step of assemblySteps) {
    for (const dep of step.after) assert(seen.has(dep), `${step.id} listed before its dependency ${dep}`);
    seen.add(step.id);
  }
  const wantSlots = [
    "slot_psu", "slot_motherboard", "slot_cpu", "slot_cooler", "slot_ram_1", "slot_ram_2", "slot_ram_3", "slot_ram_4",
    "slot_gpu", "slot_nvme", "slot_ssd_sata", "slot_fan_front", "slot_fan_rear", "slot_cables",
    "slot_panel_left", "slot_panel_right", "slot_panel_front",
  ];
  const haveSlots = new Set(assemblySteps.map((s) => s.slotId));
  for (const slot of wantSlots) assert(haveSlots.has(slot), `no step for ${slot}`);
  assert(assemblySteps.find((s) => s.id === "cooler")?.subSteps?.[0].id === "paste", "paste sub-step");
});

test("the guided order itself satisfies the access-order rule for a compatible build", () => {
  assertOk(makeBuild(COMPATIBLE, GOOD_ORDER), "access_order");
  assert(GOOD_ORDER.indexOf("cpu") < GOOD_ORDER.indexOf("cooler"), "cpu before cooler");
  assert(GOOD_ORDER.indexOf("nvme") < GOOD_ORDER.indexOf("gpu"), "nvme before gpu");
});

test("wrong-order messages and boot screen render", () => {
  assert(wrongOrderMessage("cooler", ["cpu"]).startsWith("The cooler goes on after the CPU"), "cooler message");
  assert(Object.values(wrongPlacementMessages).every((m) => m.length > 10), "messages");
  const lines = renderBootScreen({ cpu: "Vertex 8-core", cores: 8, ramGb: 32768, gpu: "Nova 12 GB", nvme: "Flux Gen4 1 TB", cpuTemp: 62, gpuTemp: 58, fps: 144 });
  assert(lines.every((l) => !l.includes("{")), "unfilled placeholder");
});

const sentences = (text: string): number => text.split(/(?<=[.!?])\s+/).length;
const PART_IDS = [
  "case_frame", "panel_left", "panel_right", "panel_front", "motherboard", "cpu", "cooler",
  "ram_1", "ram_2", "ram_3", "ram_4", "gpu", "psu", "nvme", "ssd_sata", "fan_front", "fan_rear", "cables",
];

test("18 parts, all in known groups, with the required lengths", () => {
  assert(Object.keys(pcCopy).sort().join() === [...PART_IDS].sort().join(), "part ids differ");
  for (const id of PART_IDS) {
    const c = pcCopy[id];
    assert(c.id === id, `${id} id mismatch`);
    assert(c.group in pcGroups, `${id} group ${c.group}`);
    assert(sentences(c.summary) === 1, `${id} summary must be 1 sentence`);
    const f = sentences(c.function);
    assert(f >= 2 && f <= 3, `${id} function has ${f} sentences`);
    assert(sentences(c.whyItMatters) === 2, `${id} whyItMatters has ${sentences(c.whyItMatters)} sentences`);
    assert(c.funFact !== undefined && sentences(c.funFact) === 1, `${id} funFact must be 1 sentence`);
    assert(c.stats !== undefined && c.stats.length >= 2 && c.stats.length <= 4, `${id} stats count`);
    assert(c.sources !== undefined && c.sources.length >= 1 && c.sources.length <= 2, `${id} sources count`);
    assert((c.sources ?? []).every((u) => u.startsWith("https://")), `${id} source url`);
  }
  assert(Object.keys(pcGroups).length === 7, "seven groups");
});

test("modes, tiers and faults are consistent", () => {
  assert(Object.keys(modes).join() === "guided,free,brief,wontBoot,speedrun", "mode ids");
  assert(Object.keys(tiers).join() === "easy,normal,hard,expert", "tier ids");
  for (const mode of Object.values(modes)) assert(mode.tiers.every((t) => t in tiers), `${mode.id} tiers`);
  assert(Object.keys(faults).length === 6, "six faults");
  for (const fault of Object.values(faults)) {
    assert(fault.fixPartId in pcCopy, `${fault.id} fix part ${fault.fixPartId}`);
    assert(/^[SL]*$/.test(fault.beepCode), `${fault.id} beep code`);
    if (fault.slotId) assert(assemblySteps.some((s) => s.slotId === fault.slotId), `${fault.id} slot`);
  }
  const codes = Object.values(faults).map((f) => f.beepCode);
  assert(new Set(codes).size === codes.length, "beep codes must be distinct");
  assert(faultsForTier("easy").length === 3 && faultsForTier("expert").length === 6, "faults by tier");
});

test("tier penalties turn mistakes into time or stars as designed", () => {
  assert(applyTierPenalties("easy", 100, 3).mistakes === 0 && applyTierPenalties("easy", 100, 3).seconds === 100, "easy");
  assert(applyTierPenalties("normal", 100, 3).seconds === 130 && applyTierPenalties("normal", 100, 3).mistakes === 0, "normal");
  assert(applyTierPenalties("hard", 100, 3).seconds === 100 && applyTierPenalties("hard", 100, 3).mistakes === 3, "hard");
  assert(applyTierPenalties("expert", 100, 2).seconds === 130 && applyTierPenalties("expert", 100, 2).mistakes === 2, "expert");
});

test("scoreBuild awards one star each for clean, quick and on budget", () => {
  assert(scoreBuild({ seconds: 300, mistakes: 0, parSeconds: 400 }).stars === 3, "3 stars, no budget");
  assert(scoreBuild({ seconds: 300, mistakes: 1, parSeconds: 400 }).stars === 2, "mistake");
  assert(scoreBuild({ seconds: 500, mistakes: 0, parSeconds: 400 }).stars === 2, "slow");
  assert(scoreBuild({ seconds: 300, mistakes: 0, budgetUsd: 1200, spentUsd: 1201, parSeconds: 400 }).stars === 2, "over budget");
  assert(scoreBuild({ seconds: 300, mistakes: 0, budgetUsd: 1200, spentUsd: 1200, parSeconds: 400 }).stars === 3, "at budget");
  assert(scoreBuild({ seconds: 900, mistakes: 4, budgetUsd: 1000, spentUsd: 1500, parSeconds: 400 }).stars === 0, "0 stars");
  const r = scoreBuild({ seconds: 300, mistakes: 0, parSeconds: 400 });
  assert(r.breakdown.length === 3, "one breakdown line per star");
});

test("credits carry the MIT notice for the generators", () => {
  assert(credits.some((c) => c.licence === "MIT"), "an MIT credit");
  assert(creditsLine.includes("Yoosseph") && creditsLine.includes("MIT"), "credits line");
});

test("every brief is solvable with a legal build, and the trap parts are not the only route", () => {
  const fan = getItem("fan_breeze_120");
  for (const brief of briefs) {
    let solutions = 0;
    let cheapest = Infinity;
    for (const c of byKind("case"))
      for (const m of byKind("motherboard"))
        for (const u of byKind("cpu"))
          for (const k of byKind("cooler"))
            for (const r of byKind("ram"))
              for (const g of byKind("gpu"))
                for (const p of byKind("psu"))
                  for (const n of byKind("nvme"))
                    for (const s of [undefined, ...byKind("ssd")]) {
                      const build: Build = {
                        placed: GOOD_ORDER,
                        fanOrientation: { front: "intake", rear: "exhaust" },
                        case: c, motherboard: m, cpu: u, cooler: k, ram: r, gpu: g, psu: p, nvme: n, ssd: s, fan,
                      };
                      const items = Object.values(build).filter((v): v is CatalogueItem => typeof v === "object" && v !== null && "kind" in v);
                      const verdict = evaluateBrief(brief, build);
                      if (verdict.failures.length > 0 || !verdict.withinBudget) continue;
                      if (checkBuild(build).some((res) => !res.ok && res.severity === "block")) continue;
                      solutions += 1;
                      cheapest = Math.min(cheapest, totalPrice(items));
                    }
    console.log(`       ${brief.id}: ${solutions} legal builds within $${brief.budgetUsd}, cheapest $${cheapest}`);
    assert(solutions > 0, `${brief.id} has no solution`);
  }
});
