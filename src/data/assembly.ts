/**
 * The guided assembly order.
 *
 * `case_frame` is the base and is present from the start, with all three panels detached, so it
 * has no step. Array order is the recommended linear order; `after` holds the hard dependencies
 * (step ids) that "order locked" tiers enforce. Steps 3 to 8 (CPU, RAM, NVMe) happen on the bench
 * before the board goes into the case, which is also how real builds are done.
 *
 * The motherboard appears twice on purpose: `board_bench` sets it on the bench, and `board_case`
 * moves the same part into the case (`movesExisting`).
 */

export interface AssemblySubStep {
  id: string;
  label: string;
  hint: string;
  reason: string;
}

export interface AssemblyStep {
  id: string;
  partId: string;
  slotId: string;
  after: string[];
  label: string;
  /** Where it goes. */
  hint: string;
  /** Why this order. Shown as the wrong-order message, so it reads as a sentence. */
  reason: string;
  phase: "bench" | "case" | "final";
  kind: "place" | "action";
  /** Only needed for some builds (for example the extra sticks of a four-stick kit). */
  optional?: boolean;
  /** The part is already placed and this step moves it. */
  movesExisting?: boolean;
  subSteps?: AssemblySubStep[];
}

export const assemblySteps: AssemblyStep[] = [
  {
    id: "psu",
    partId: "psu",
    slotId: "slot_psu",
    after: [],
    label: "Fit the power supply",
    hint: "Slide it into the bay at the bottom rear of the case, fan facing down, and screw it to the back plate.",
    reason: "The power supply goes in first: once the board is in, the bay is a tight squeeze for your hands.",
    phase: "case",
    kind: "place",
  },
  {
    id: "board_bench",
    partId: "motherboard",
    slotId: "slot_motherboard",
    after: ["psu"],
    label: "Lay the motherboard on the bench",
    hint: "Rest it on its box or a mat. CPU, memory and the NVMe drive are far easier to fit before the board is in the case.",
    reason: "The board goes on the bench first: the CPU, memory and drive are easier to fit with room to work.",
    phase: "bench",
    kind: "place",
  },
  {
    id: "cpu",
    partId: "cpu",
    slotId: "slot_cpu",
    after: ["board_bench"],
    label: "Seat the CPU",
    hint: "Lift the socket lever, line up the corner triangle on the CPU with the one on the socket, lower it flat, and push the lever down.",
    reason: "The CPU goes in before the cooler: the cooler sits right on top of it and would cover the socket.",
    phase: "bench",
    kind: "place",
  },
  {
    id: "ram_2",
    partId: "ram_2",
    slotId: "slot_ram_2",
    after: ["cpu"],
    label: "Install memory stick in slot 2",
    hint: "Open the clips, line the notch up with the key in the slot, and press firmly at both ends until both clips click.",
    reason: "Memory goes in before the cooler: a tower overhangs the memory slots and blocks your fingers.",
    phase: "bench",
    kind: "place",
  },
  {
    id: "ram_4",
    partId: "ram_4",
    slotId: "slot_ram_4",
    after: ["cpu"],
    label: "Install memory stick in slot 4",
    hint: "The second stick of a pair goes in slot 4, so the two sticks sit in different channels.",
    reason: "Memory goes in before the cooler: a tower overhangs the memory slots and blocks your fingers.",
    phase: "bench",
    kind: "place",
  },
  {
    id: "ram_1",
    partId: "ram_1",
    slotId: "slot_ram_1",
    after: ["ram_2", "ram_4"],
    label: "Install memory stick in slot 1 (four-stick kits)",
    hint: "Only for a four-stick kit: fill the remaining slots after slots 2 and 4.",
    reason: "The extra sticks go in after the first pair, so the pair sits in the right channels.",
    phase: "bench",
    kind: "place",
    optional: true,
  },
  {
    id: "ram_3",
    partId: "ram_3",
    slotId: "slot_ram_3",
    after: ["ram_2", "ram_4"],
    label: "Install memory stick in slot 3 (four-stick kits)",
    hint: "Only for a four-stick kit: fill the remaining slots after slots 2 and 4.",
    reason: "The extra sticks go in after the first pair, so the pair sits in the right channels.",
    phase: "bench",
    kind: "place",
    optional: true,
  },
  {
    id: "nvme",
    partId: "nvme",
    slotId: "slot_nvme",
    after: ["board_bench"],
    label: "Fit the NVMe drive",
    hint: "Slide it into the M.2 slot at a slight angle, press it flat and fasten the small screw. Fit the heatsink over it.",
    reason: "The NVMe drive goes in before the graphics card: the card sits over the M.2 slot and would cover it.",
    phase: "bench",
    kind: "place",
  },
  {
    id: "board_case",
    partId: "motherboard",
    slotId: "slot_motherboard",
    after: ["cpu", "ram_2", "ram_4", "nvme"],
    label: "Mount the board in the case",
    hint: "Check the standoffs and the I/O shield, lower the board onto them and fasten it with a screw at each corner.",
    reason: "The board goes into the case once the CPU, memory and drive are on it, while you can still reach every socket.",
    phase: "case",
    kind: "place",
    movesExisting: true,
  },
  {
    id: "cooler",
    partId: "cooler",
    slotId: "slot_cooler",
    after: ["board_case"],
    label: "Fit the CPU cooler",
    hint: "Place the cooler squarely over the CPU, tighten the screws a little at a time in a cross pattern, and plug its fan into the CPU fan header.",
    reason: "The cooler goes on after the CPU: it sits on top of the socket, so the CPU has to be in first.",
    phase: "case",
    kind: "place",
    subSteps: [
      {
        id: "paste",
        label: "Apply thermal paste",
        hint: "A pea-sized dot in the middle of the CPU lid. Too little leaves gaps and too much squeezes out onto the board.",
        reason: "Paste goes on the CPU just before the cooler: once the cooler is down, it can never be added.",
      },
    ],
  },
  {
    id: "fan_front",
    partId: "fan_front",
    slotId: "slot_fan_front",
    after: ["cooler"],
    label: "Mount the front intake fan",
    hint: "Fit it behind the front panel with the arrow pointing into the case (air flows in).",
    reason: "The fans go in after the cooler, so you can set them clear of it and see which way the air will flow.",
    phase: "case",
    kind: "place",
  },
  {
    id: "fan_rear",
    partId: "fan_rear",
    slotId: "slot_fan_rear",
    after: ["cooler"],
    label: "Mount the rear exhaust fan",
    hint: "Fit it at the back beside the CPU cooler with the arrow pointing out of the case (air flows out).",
    reason: "The fans go in after the cooler, so you can set them clear of it and see which way the air will flow.",
    phase: "case",
    kind: "place",
  },
  {
    id: "gpu",
    partId: "gpu",
    slotId: "slot_gpu",
    after: ["nvme", "fan_front", "fan_rear"],
    label: "Install the graphics card",
    hint: "Remove the rear slot covers, push the card into the top x16 slot until the latch clicks, and screw it to the rear bracket.",
    reason: "The graphics card goes in late: it is big and it covers the NVMe slot and the space around the cooler.",
    phase: "case",
    kind: "place",
  },
  {
    id: "ssd_sata",
    partId: "ssd_sata",
    slotId: "slot_ssd_sata",
    after: ["gpu"],
    label: "Mount the SATA drive",
    hint: "Screw it into the bracket on the back of the motherboard tray, with the connectors facing the cable gap.",
    reason: "The SATA drive goes in before the cables, so its data and power leads can be routed along with the rest.",
    phase: "case",
    kind: "place",
  },
  {
    id: "cables",
    partId: "cables",
    slotId: "slot_cables",
    after: ["ssd_sata"],
    label: "Connect the cables",
    hint: "The 24-pin to the edge of the board, the 8-pin CPU lead to the top corner, the PCIe leads to the card, and SATA power and data to the drive. Route them behind the tray.",
    reason: "The cables go in after every part is fitted: each lead has to reach a part that is already in place.",
    phase: "case",
    kind: "place",
  },
  {
    id: "panel_left",
    partId: "panel_left",
    slotId: "slot_panel_left",
    after: ["cables"],
    label: "Close the left glass panel",
    hint: "Hang it on its hooks and fasten the thumbscrews. It should close flat without pressing on any part.",
    reason: "The panels go on last: they close the case, and you would have to take them off again to fit anything else.",
    phase: "final",
    kind: "place",
  },
  {
    id: "panel_right",
    partId: "panel_right",
    slotId: "slot_panel_right",
    after: ["cables"],
    label: "Close the right steel panel",
    hint: "Close it over the cable side. If it will not sit flat, a cable bundle needs to be pushed back.",
    reason: "The panels go on last: they close the case, and you would have to take them off again to fit anything else.",
    phase: "final",
    kind: "place",
  },
  {
    id: "panel_front",
    partId: "panel_front",
    slotId: "slot_panel_front",
    after: ["cables", "fan_front"],
    label: "Snap on the front panel",
    hint: "Press it onto its clips. The front fan is already behind it.",
    reason: "The front panel goes on after the front fan, because the fan sits behind it.",
    phase: "final",
    kind: "place",
  },
  {
    id: "power_on",
    partId: "psu",
    slotId: "slot_psu",
    after: ["panel_left", "panel_right", "panel_front"],
    label: "Power on",
    hint: "Plug in the mains lead, flip the switch on the power supply and press the power button.",
    reason: "Power comes last: every part must be in and every lead connected before the first boot.",
    phase: "final",
    kind: "action",
  },
];

/** The message to show when a part is placed too early. Uses the step's own reason. */
export function wrongOrderMessage(stepId: string, missing: string[] = []): string {
  const step = assemblySteps.find((s) => s.id === stepId);
  if (!step) return wrongPlacementMessages.wrong_slot;
  if (missing.length === 0) return step.reason;
  const names = missing
    .map((id) => assemblySteps.find((s) => s.id === id)?.label ?? id)
    .map((label) => label.charAt(0).toLowerCase() + label.slice(1));
  return `${step.reason} First: ${names.join(", ")}.`;
}

/** Common mistakes, keyed for the game to look up. Every string is shown as written. */
export const wrongPlacementMessages: Record<string, string> = {
  wrong_slot: "That part does not go there.",
  wrong_ram_slot: "Memory goes in the long slots next to the CPU, not anywhere else.",
  ram_single_channel: "Two sticks belong in slots 2 and 4. In these slots they would share one channel.",
  ram_not_seated: "Press firmly at both ends until both clips click. It is not fully in yet.",
  cpu_orientation: "Line up the triangle on the CPU with the triangle on the socket.",
  cooler_before_cpu: "The cooler goes on after the CPU: it sits on top of the socket, so the CPU has to be in first.",
  cooler_no_paste: "There is no thermal paste on the CPU. Add a pea-sized dot before the cooler goes down.",
  paste_too_much: "That is far too much paste. It will squeeze out over the socket and the board.",
  paste_too_little: "That is too little paste. There will be gaps and the CPU will run hot.",
  gpu_before_nvme: "The graphics card covers the M.2 slot. Fit the NVMe drive before the card goes in.",
  gpu_wrong_slot: "The graphics card belongs in the top x16 slot, the one nearest the CPU.",
  gpu_no_power: "The graphics card needs its power lead. Plug it in before you power on.",
  ram_after_cooler: "A tower cooler overhangs the memory slots. Fit the memory before the cooler.",
  panel_too_early: "The panels close the case, so they go on last. There is still something to fit.",
  board_before_psu: "Fit the power supply before the board. With the board in, the bay is a tight squeeze.",
  psu_wrong_bay: "The power supply goes in the bay at the bottom of the case.",
  psu_too_big: "That power supply does not fit this case.",
  cable_wrong_socket: "That plug does not go there. The CPU lead goes in the CPU power socket, not a PCIe socket.",
  eps_missing: "The CPU power lead is not connected. The board will not start without it.",
  fan_backwards: "That fan is backwards. Check the arrow on its frame: air should flow front to back.",
  fan_blocked: "Something is touching the fan blades. Move the loose cable out of the way.",
  form_factor: "That board is too big for this case.",
  socket_mismatch: "That CPU does not fit this socket.",
  ram_generation: "That memory has its notch in a different place. It is the wrong generation for this board.",
  bios_flash: "The board does not recognise this CPU yet. It needs a BIOS flash first.",
  cooler_too_tall: "That cooler is too tall for the case. The side panel will not close.",
  ram_hits_cooler: "The tall memory heatspreaders hit the cooler's fan. Use lower memory or a different cooler.",
  gpu_too_long: "That graphics card is too long for the case.",
  psu_too_small: "That power supply is too small for this CPU and graphics card.",
  drive_wrong_bay: "The SATA drive goes in the bracket behind the motherboard tray.",
};

/**
 * What the machine looks, sounds and reads like when it is working.
 * Boot lines use {placeholders}; fill them with `renderBootScreen`.
 */
export const feedback = {
  snap: {
    description:
      "A short thunk with a 60 to 90 ms squash-and-settle on the part and a small flash on the socket. Screws fill a ring while held. Android gets a 12 ms haptic tick where supported.",
    squashMs: [60, 90] as [number, number],
    hapticMs: 12,
  },
  rejection: {
    description: "A short shake and a dull knock. The target glows red and the reason appears where the rules allow it.",
    shakeMs: 220,
  },
  cableLatch: {
    description: "A crisp click, like a latch. A wrong plug refuses with a shake instead.",
  },
  postBeep: {
    pattern: "S",
    frequencyHz: 1000,
    durationMs: 180,
    description: "One short beep, about 180 ms at 1 kHz: the sound a healthy machine makes when it passes its power-on checks.",
  },
  beepGlossary: {
    S: { name: "short", durationMs: 150, gapMs: 150, frequencyHz: 1000 },
    L: { name: "long", durationMs: 450, gapMs: 150, frequencyHz: 1000 },
  } as Record<"S" | "L", { name: string; durationMs: number; gapMs: number; frequencyHz: number }>,
  fanSpinUp: {
    description:
      "The rear fan starts first, then the front fan, then the CPU cooler and the graphics card, each 250 ms after the last, ramping to speed over about a second.",
    order: ["fan_rear", "fan_front", "cooler", "gpu"],
    staggerMs: 250,
    rampMs: 900,
  },
  rgb: {
    description: "The lighting fades in over about a second, starting at the fans and finishing on the graphics card.",
    fadeMs: 1000,
  },
  bootScreenLines: [
    "Boot firmware v1.02",
    "CPU: {cpu} detected, {cores} cores",
    "Memory test: {ramGb} MB ..... OK",
    "GPU: {gpu} ..... OK",
    "NVMe: {nvme} ..... OK",
    "Fan check: front OK, rear OK, CPU OK",
    "Thermals: CPU {cpuTemp} C, GPU {gpuTemp} C",
    "Running mini benchmark ...",
    "Result: {fps} FPS at 1440p",
    "POST complete. Booting.",
  ],
};

/** Fills the {placeholders} in the boot screen text. Unknown placeholders are left visible. */
export function renderBootScreen(vars: Record<string, string | number>): string[] {
  return feedback.bootScreenLines.map((line) =>
    line.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)),
  );
}
