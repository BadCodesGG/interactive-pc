import type { CatalogueItem, CatalogueKind } from "./catalogue";

export type RuleResult =
  | { ok: true }
  | { ok: false; reason: string; severity: "block" | "warn" };

export type FanOrientation = "intake" | "exhaust";

/**
 * The state the rules look at: the catalogue item picked for each kind, plus the part ids
 * placed so far IN PLACEMENT ORDER (the access-order rule reads the order of this array).
 */
export type Build = Partial<Record<CatalogueKind, CatalogueItem>> & {
  placed: string[];
  fanOrientation?: { front?: FanOrientation; rear?: FanOrientation };
};

export interface Rule {
  id: string;
  label: string;
  /** Hidden on the Hard tier: still enforced, but not shown on the spec sheet or before a drop. */
  hiddenOnHard?: boolean;
  check: (build: Build) => RuleResult;
}

const OK: RuleResult = { ok: true };
const block = (reason: string): RuleResult => ({ ok: false, reason, severity: "block" });
const warn = (reason: string): RuleResult => ({ ok: false, reason, severity: "warn" });

/**
 * Blocks beat warnings. With `merge` (the default) every failure of the winning severity is
 * reported, joined into one reason; without it only the first is.
 */
function worst(results: RuleResult[], merge = true): RuleResult {
  const failures = results.filter((r): r is Extract<RuleResult, { ok: false }> => !r.ok);
  const severity = failures.some((f) => f.severity === "block") ? "block" : "warn";
  const top = failures.filter((f) => f.severity === severity);
  if (top.length === 0) return OK;
  return { ok: false, severity, reason: (merge ? top : top.slice(0, 1)).map((f) => f.reason).join(" ") };
}

// Spec accessors throw on a missing key so a typo in the catalogue cannot silently pass a rule.
function num(item: CatalogueItem, key: string): number {
  const value = item.spec[key];
  if (typeof value !== "number") throw new Error(`${item.id}: spec "${key}" must be a number`);
  return value;
}
function str(item: CatalogueItem, key: string): string {
  const value = item.spec[key];
  if (typeof value !== "string") throw new Error(`${item.id}: spec "${key}" must be a string`);
  return value;
}
function bool(item: CatalogueItem, key: string): boolean {
  const value = item.spec[key];
  if (typeof value !== "boolean") throw new Error(`${item.id}: spec "${key}" must be a boolean`);
  return value;
}
function list(item: CatalogueItem, key: string): string[] {
  return str(item, key)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const RAM_IDS = ["ram_1", "ram_2", "ram_3", "ram_4"];
const PANEL_IDS = ["panel_left", "panel_right", "panel_front"];

/** 1. The board must fit the case. */
const formFactor: Rule = {
  id: "form_factor",
  label: "Board fits the case",
  check: ({ case: pcCase, motherboard }) => {
    if (!pcCase || !motherboard) return OK;
    const board = str(motherboard, "formFactor");
    if (list(pcCase, "formFactors").includes(board)) return OK;
    return block(
      `${motherboard.name} is a ${board} board, but ${pcCase.name} only takes ${list(pcCase, "formFactors").join(", ")}.`,
    );
  },
};

/** 2. CPU socket matches the board socket. */
const cpuSocket: Rule = {
  id: "cpu_socket",
  label: "CPU socket matches the board",
  check: ({ cpu, motherboard }) => {
    if (!cpu || !motherboard) return OK;
    const cpuSock = str(cpu, "socket");
    const boardSock = str(motherboard, "socket");
    if (cpuSock === boardSock) return OK;
    return block(`${cpu.name} uses the ${cpuSock} socket, but ${motherboard.name} has a ${boardSock} socket.`);
  },
};

/** 3. The board's shipped BIOS must know the CPU generation (the "needs a BIOS flash" trap). */
const biosChipset: Rule = {
  id: "bios_chipset",
  label: "Chipset and BIOS support this CPU",
  check: ({ cpu, motherboard }) => {
    if (!cpu || !motherboard) return OK;
    // A socket mismatch is rule 2's problem; comparing generations across sockets is meaningless.
    if (str(cpu, "socket") !== str(motherboard, "socket")) return OK;
    const gen = num(cpu, "gen");
    const supported = num(motherboard, "biosSupportsGen");
    if (gen <= supported) return OK;
    return block(
      `${motherboard.name} (${str(motherboard, "chipset")}) ships with a BIOS that only knows generation ${supported} CPUs, and ${cpu.name} is generation ${gen}. It needs a BIOS flash first, and the board will not start to do it.`,
    );
  },
};

/** 4. RAM generation matches the board, and the sticks fit the slots. */
const ramCompat: Rule = {
  id: "ram_compat",
  label: "Memory generation and slot count",
  check: (build) => {
    const { ram, motherboard } = build;
    if (!ram || !motherboard) return OK;
    const results: RuleResult[] = [];
    if (str(ram, "gen") !== str(motherboard, "ramGen")) {
      results.push(
        block(
          `${ram.name} is ${str(ram, "gen")}, but ${motherboard.name} takes ${str(motherboard, "ramGen")}. The notch is in a different place.`,
        ),
      );
    }
    const slots = num(motherboard, "ramSlots");
    const sticks = num(ram, "sticks");
    if (sticks > slots) {
      results.push(block(`${ram.name} has ${sticks} sticks, but ${motherboard.name} only has ${slots} memory slots.`));
    }
    const placedRam = build.placed.filter((id) => RAM_IDS.includes(id));
    if (placedRam.length > sticks) {
      results.push(block(`The kit only has ${sticks} sticks, but ${placedRam.length} are in slots.`));
    }
    if (placedRam.length > slots) {
      results.push(block(`This board only has ${slots} memory slots.`));
    }
    if (slots >= 4 && placedRam.length === 2 && !(placedRam.includes("ram_2") && placedRam.includes("ram_4"))) {
      results.push(warn("Two sticks belong in slots 2 and 4. In these slots they share one channel and run at half the bandwidth."));
    }
    return worst(results);
  },
};

/** 5. Cooler brackets fit the socket, and the cooler can handle the CPU's heat. */
const coolerSocketTdp: Rule = {
  id: "cooler_socket_tdp",
  label: "Cooler mounts and cooling rating",
  check: ({ cooler, cpu }) => {
    if (!cooler || !cpu) return OK;
    const results: RuleResult[] = [];
    const socket = str(cpu, "socket");
    if (!list(cooler, "sockets").includes(socket)) {
      results.push(block(`${cooler.name} has no bracket for the ${socket} socket (it fits ${list(cooler, "sockets").join(", ")}).`));
    }
    if (num(cooler, "tdpW") < num(cpu, "tdpW")) {
      results.push(
        warn(
          `${cooler.name} is rated for ${num(cooler, "tdpW")} W and ${cpu.name} produces ${num(cpu, "tdpW")} W. It will run, but the CPU will throttle under load.`,
        ),
      );
    }
    return worst(results);
  },
};

/** 6. Air coolers must clear the side panel; radiators must fit a case mount. */
const coolerFit: Rule = {
  id: "cooler_fit",
  label: "Cooler or radiator fits the case",
  check: ({ cooler, case: pcCase }) => {
    if (!cooler || !pcCase) return OK;
    if (str(cooler, "type") === "aio") {
      const rad = num(cooler, "radiatorMm");
      if (list(pcCase, "radiatorMounts").includes(String(rad))) return OK;
      return block(
        `${pcCase.name} has no ${rad} mm radiator mount (it takes ${list(pcCase, "radiatorMounts").join(", ")} mm).`,
      );
    }
    const height = num(cooler, "heightMm");
    const max = num(pcCase, "coolerMaxHeightMm");
    if (height <= max) return OK;
    return block(`${cooler.name} is ${height} mm tall, but ${pcCase.name} only clears ${max} mm. The side panel will not close.`);
  },
};

/** 7. Tall RAM under an air tower's fan (the rule a parts-list checker cannot see). */
const ramTowerClearance: Rule = {
  id: "ram_tower_clearance",
  label: "Memory fits under the air cooler",
  hiddenOnHard: true,
  check: ({ ram, cooler }) => {
    if (!ram || !cooler) return OK;
    if (str(cooler, "type") !== "air") return OK;
    const ramHeight = num(ram, "heightMm");
    const clearance = num(cooler, "ramClearanceMm");
    if (ramHeight <= clearance) return OK;
    return block(
      `${ram.name} stands ${ramHeight} mm tall, but ${cooler.name} only clears ${clearance} mm over the memory slots. The heatspreaders hit the fan.`,
    );
  },
};

/** 8. The card must fit the case in length and thickness. */
const gpuFit: Rule = {
  id: "gpu_fit",
  label: "Graphics card fits the case",
  check: ({ gpu, case: pcCase }) => {
    if (!gpu || !pcCase) return OK;
    const results: RuleResult[] = [];
    if (num(gpu, "lengthMm") > num(pcCase, "gpuMaxLengthMm")) {
      results.push(
        block(`${gpu.name} is ${num(gpu, "lengthMm")} mm long, but ${pcCase.name} only takes ${num(pcCase, "gpuMaxLengthMm")} mm.`),
      );
    }
    if (num(gpu, "slots") > num(pcCase, "expansionSlots")) {
      results.push(
        block(`${gpu.name} is ${num(gpu, "slots")} slots thick, but ${pcCase.name} only has ${num(pcCase, "expansionSlots")} free slots.`),
      );
    }
    return worst(results);
  },
};

/** 9. PSU wattage with headroom, its size, and enough leads. */
const psuPower: Rule = {
  id: "psu_power",
  label: "Power supply is big enough",
  check: ({ psu, cpu, gpu, case: pcCase, motherboard }) => {
    if (!psu) return OK;
    const results: RuleResult[] = [];
    if (cpu || gpu) {
      const draw = (cpu ? num(cpu, "tdpW") : 0) + (gpu ? num(gpu, "tdpW") : 0);
      const needed = Math.ceil(draw * 1.3);
      if (num(psu, "wattage") < needed) {
        results.push(
          block(
            `${psu.name} gives ${num(psu, "wattage")} W, but the CPU and GPU draw ${draw} W and you want 30 percent headroom, so at least ${needed} W.`,
          ),
        );
      }
    }
    if (pcCase && !list(pcCase, "psuFormFactors").includes(str(psu, "formFactor"))) {
      results.push(
        block(`${psu.name} is ${str(psu, "formFactor")}, but ${pcCase.name} only takes ${list(pcCase, "psuFormFactors").join(", ")}.`),
      );
    }
    if (motherboard && num(psu, "epsConnectors") < num(motherboard, "epsConnectors")) {
      results.push(
        block(`${motherboard.name} wants ${num(motherboard, "epsConnectors")} CPU power leads, but ${psu.name} only has ${num(psu, "epsConnectors")}.`),
      );
    }
    if (gpu && num(psu, "pcieConnectors") < num(gpu, "pcieConnectors")) {
      results.push(
        block(`${gpu.name} needs ${num(gpu, "pcieConnectors")} PCIe power leads, but ${psu.name} only has ${num(psu, "pcieConnectors")}.`),
      );
    }
    return worst(results);
  },
};

/** 10. Access order. Reads the order of `placed`. */
const accessOrder: Rule = {
  id: "access_order",
  label: "Parts go in an order you can reach",
  check: (build) => {
    const placed = build.placed;
    const at = (id: string): number => placed.indexOf(id);
    const results: RuleResult[] = [];

    /** `second` was placed, and `first` was not placed before it. */
    const mustFollow = (first: string, second: string, reason: string, opts?: { severity?: "block" | "warn"; needFirst?: boolean }) => {
      const s = at(second);
      if (s < 0) return;
      const f = at(first);
      const violated = f < 0 ? Boolean(opts?.needFirst) : f > s;
      if (violated) results.push(opts?.severity === "warn" ? warn(reason) : block(reason));
    };

    mustFollow("cpu", "cooler", "The cooler goes on after the CPU: it sits on top of the socket, so the CPU has to be in first.", {
      needFirst: true,
    });
    mustFollow("motherboard", "cooler", "The cooler bolts to the motherboard, so the board has to be in first.", { needFirst: true });
    mustFollow("motherboard", "gpu", "The graphics card plugs into the motherboard, so the board has to be in first.", { needFirst: true });
    mustFollow("motherboard", "cables", "The cables plug into the motherboard and the parts on it, so the board has to be in first.", {
      needFirst: true,
    });
    mustFollow("nvme", "gpu", "The graphics card covers the M.2 slot. Fit the NVMe drive before the card goes in.");
    mustFollow("psu", "motherboard", "Fit the power supply before the board. With the board in, the bay is a tight squeeze.", {
      severity: "warn",
    });

    // A tower cooler overhangs the memory slots, so sticks go in first.
    if (build.cooler?.spec.type !== "aio") {
      for (const id of RAM_IDS) {
        mustFollow(id, "cooler", "A tower cooler overhangs the memory slots. Fit the memory before the cooler.");
      }
    }

    // A big tower makes the CPU power lead a squeeze. Warn only, the guided order plugs cables late.
    if (build.cooler && bool(build.cooler, "blocksEps")) {
      mustFollow("cables", "cooler", "This tower leaves little room around the CPU power socket. Plug in the CPU power lead before you fit it.", {
        severity: "warn",
      });
    }

    // Panels go on last: nothing may be placed after a panel is on.
    const firstPanel = Math.min(...PANEL_IDS.map(at).filter((i) => i >= 0), Infinity);
    if (firstPanel !== Infinity) {
      const late = placed.slice(firstPanel + 1).filter((id) => !PANEL_IDS.includes(id));
      if (late.length > 0) {
        results.push(block(`The panels close the case, so they go on last. ${late[0].replace(/_/g, " ")} still had to go in.`));
      }
    }

    return worst(results, false);
  },
};

/** 11. Case fan orientation (a warning, it feeds the thermal score). */
const fanOrientation: Rule = {
  id: "fan_orientation",
  label: "Fans move air front to back",
  check: ({ fanOrientation: orientation }) => {
    if (!orientation) return OK;
    const results: RuleResult[] = [];
    if (orientation.front === "exhaust") {
      results.push(warn("The front fan blows out. Front fans should be intake, or the case will not pull in cool air."));
    }
    if (orientation.rear === "intake") {
      results.push(warn("The rear fan blows in. The rear fan should exhaust the hot air out of the back."));
    }
    return worst(results);
  },
};

export const rules: Rule[] = [
  formFactor,
  cpuSocket,
  biosChipset,
  ramCompat,
  coolerSocketTdp,
  coolerFit,
  ramTowerClearance,
  gpuFit,
  psuPower,
  accessOrder,
  fanOrientation,
];

/** One result per rule, in the same order as `rules`. */
export function checkBuild(build: Build): RuleResult[] {
  return rules.map((rule) => rule.check(build));
}

/** Results paired with their rule, for a UI that needs labels and the hidden flag. */
export function checkBuildDetailed(build: Build): { rule: Rule; result: RuleResult }[] {
  return rules.map((rule) => ({ rule, result: rule.check(build) }));
}
