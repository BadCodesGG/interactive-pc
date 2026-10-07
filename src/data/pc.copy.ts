import type { CopyBook, PartCopy } from "../engine/explode/copy";

const WIKI = "https://en.wikipedia.org/wiki/";

/** The four memory sticks share their facts; each slot adds its own guidance. */
const ramBase: Omit<PartCopy, "id" | "label" | "summary" | "whyItMatters" | "funFact"> = {
  group: "compute",
  function:
    "Memory holds the data the CPU is working on right now, because it is far quicker to reach than any drive. Sticks work in pairs across two channels, so two matched modules double the bandwidth of one. Everything in it is wiped when the power goes off.",
  stats: [
    { label: "Typical kit", value: "32 GB (2 x 16 GB)" },
    { label: "Speed", value: "DDR5-6000 (6,000 MT/s)" },
    { label: "Dual-channel bandwidth", value: "about 96 GB/s" },
    { label: "Stick height", value: "34 mm standard, 50 mm+ tall" },
  ],
  sources: [`${WIKI}DDR5_SDRAM`],
};

export const pcCopy: CopyBook = {
  case_frame: {
    id: "case_frame",
    label: "Case frame",
    group: "chassis",
    summary: "The steel skeleton that holds every other part and decides what will fit.",
    function:
      "The frame carries the motherboard on a tray of screw standoffs, the power supply in its own bay, and the drives and fans on brackets. It sets the maximum length of the graphics card and the maximum height of the CPU cooler. Its vents and fan mounts decide how air flows through the machine.",
    whyItMatters:
      "A case that is too small rules out long cards and tall coolers before you have bought them. A case with poor airflow makes every hot part run louder and slower.",
    funFact: "The ATX layout that nearly every tower still follows was published by Intel in 1995.",
    stats: [
      { label: "Board sizes", value: "ATX, mATX, ITX" },
      { label: "GPU clearance", value: "330 to 400 mm" },
      { label: "Expansion slots", value: "7" },
      { label: "Fan mounts", value: "6 to 8" },
    ],
    sources: [`${WIKI}Computer_case`, `${WIKI}ATX`],
  },
  panel_left: {
    id: "panel_left",
    label: "Left side panel (glass)",
    group: "chassis",
    summary: "The tempered glass window that shows off the motherboard side.",
    function:
      "It closes the main compartment so air is pulled through the intake fans instead of leaking around the sides. The glass lets you see the parts and the lighting. It hangs on thumbscrews or hinges and comes off first when you want to work inside.",
    whyItMatters:
      "Leave it off and the airflow path breaks, so the fans stop cooling the hottest parts and dust settles on the board. Fit it before the last cables are tucked away and it will not close, which puts the glass under strain.",
    funFact: "Tempered glass shatters into small blunt pieces rather than sharp shards, which is why cases use it.",
    stats: [
      { label: "Glass", value: "3 to 4 mm tempered" },
      { label: "Weight", value: "1.5 to 3 kg" },
    ],
    sources: [`${WIKI}Computer_case`, `${WIKI}Toughened_glass`],
  },
  panel_right: {
    id: "panel_right",
    label: "Right side panel (steel)",
    group: "chassis",
    summary: "The solid steel door that hides the cable side of the case.",
    function:
      "Behind it is the gap between the motherboard tray and this panel, where cables are bundled and drives are mounted. It keeps that clutter out of sight and out of the airflow. Its slight bulge gives the cables room so it can close flat.",
    whyItMatters:
      "If cables are stuffed in without routing, the panel will not close or it will press on a connector. A panel left off exposes bare wiring to fingers and dust.",
    funFact: "There is often 20 mm or more of room behind the motherboard tray, and good builders use every millimetre of it.",
    stats: [
      { label: "Steel", value: "0.7 to 1.0 mm" },
      { label: "Cable gap", value: "20 to 30 mm" },
    ],
    sources: [`${WIKI}Computer_case`],
  },
  panel_front: {
    id: "panel_front",
    label: "Front panel (mesh)",
    group: "chassis",
    summary: "The vented front face that lets the intake fans breathe.",
    function:
      "A mesh or slotted panel lets cool room air in while a dust filter behind it catches the worst of the dirt. It also carries the power button, the USB ports and the audio jacks. It pops off so the front fans can be reached.",
    whyItMatters:
      "A solid front starves the intake fans, and the whole case heats up as the air recirculates. A clogged filter has the same effect, only more slowly.",
    funFact: "The dust filter sits behind the front panel because intake fans pull in a fair share of the dust in the room.",
    stats: [
      { label: "Fan mounts behind it", value: "up to 3 x 120 mm" },
      { label: "Front USB", value: "USB-A and USB-C" },
    ],
    sources: [`${WIKI}Computer_case`, `${WIKI}Computer_fan`],
  },
  motherboard: {
    id: "motherboard",
    label: "Motherboard",
    group: "board",
    summary: "The main circuit board that connects every other part to the CPU.",
    function:
      "It holds the CPU socket, the memory slots, the graphics slot and the drive slots, and wires them together. A bank of voltage regulators near the socket turns the supply's 12 V into the roughly 1 V the CPU needs. Its chipset and firmware decide which CPUs and memory it will accept.",
    whyItMatters:
      "A board with the wrong socket or the wrong memory generation simply will not take the parts you bought. An old firmware version can refuse a newer CPU until it is updated.",
    funFact: "The regulators on a modern board push well over 100 amps into a CPU at about one volt.",
    stats: [
      { label: "ATX size", value: "305 x 244 mm" },
      { label: "Memory slots", value: "4 (2 on small boards)" },
      { label: "M.2 slots", value: "2 to 3" },
      { label: "GPU slot", value: "PCIe 5.0 x16" },
    ],
    sources: [`${WIKI}Motherboard`, `${WIKI}ATX`],
  },
  cpu: {
    id: "cpu",
    label: "CPU",
    group: "compute",
    summary: "The processor that runs the game logic and every other program.",
    function:
      "A CPU is a small silicon die under a metal lid, with cores that each work through instructions billions of times a second. It talks to memory, to the graphics card and to the main drive over the board. Its power rating (TDP) tells you how much heat the cooler has to remove.",
    whyItMatters:
      "The wrong socket will not physically fit, and forcing it can bend pins and kill the board. Run it with a weak cooler and it slows itself down to stay safe.",
    funFact: "A modern CPU packs billions of transistors onto a die smaller than a postage stamp.",
    stats: [
      { label: "Cores", value: "8 to 16" },
      { label: "TDP", value: "65 to 170 W" },
      { label: "Boost clock", value: "5 GHz and up" },
      { label: "PCIe 5.0 lanes", value: "about 24" },
    ],
    sources: [`${WIKI}Central_processing_unit`, `${WIKI}Thermal_design_power`],
  },
  cooler: {
    id: "cooler",
    label: "CPU cooler (air tower)",
    group: "compute",
    summary: "A tower of aluminium fins and heat pipes that pulls heat off the CPU.",
    function:
      "A copper plate sits on the CPU with a thin layer of thermal paste between them, and heat pipes carry the heat up into a stack of fins. A fan pushes air through the fins and the heat leaves the case. The mounting bracket must match the CPU socket.",
    whyItMatters:
      "With no paste, or with badly spread paste, the heat cannot cross the gap and the CPU overheats within seconds. A tower that is too tall stops the side panel closing, and one that overhangs the memory can block tall sticks.",
    funFact: "Each heat pipe is sealed with a little water inside, which boils at the hot end and condenses at the cold end, moving heat far better than solid copper.",
    stats: [
      { label: "Height", value: "155 to 165 mm" },
      { label: "Heat pipes", value: "5 to 7" },
      { label: "Cooling rating", value: "180 to 250 W" },
      { label: "Fan", value: "120 to 140 mm" },
    ],
    sources: [`${WIKI}Computer_cooling`, `${WIKI}Heat_pipe`],
  },
  ram_1: {
    ...ramBase,
    id: "ram_1",
    label: "Memory stick 1",
    summary: "Slot 1, the one nearest the CPU, only used with a four-stick kit.",
    whyItMatters:
      "Put a lone stick here and you drop to single channel, which can cost a large slice of memory bandwidth. Leave it half seated and the machine will not start.",
    funFact: "DDR5 sticks carry their own small power chip, where older memory relied on the board.",
  },
  ram_2: {
    ...ramBase,
    id: "ram_2",
    label: "Memory stick 2",
    summary: "Slot 2, the first slot to fill in a two-stick kit.",
    whyItMatters:
      "Put two sticks in the wrong pair of slots and they may share a single channel, which halves the bandwidth. A stick that is not pushed in until both clips click will make the machine fail to start.",
    funFact: "Most manuals name the correct pair of slots because the labels printed on the board are tiny.",
  },
  ram_3: {
    ...ramBase,
    id: "ram_3",
    label: "Memory stick 3",
    summary: "Slot 3, only used when the kit has four sticks.",
    whyItMatters:
      "Fill all four slots and the board often has to lower the memory speed to stay stable. A stick left half in is one of the most common reasons a new PC will not start.",
    funFact: "Many boards report a half seated stick as three short beeps, and a firm push until both clips click fixes it.",
  },
  ram_4: {
    ...ramBase,
    id: "ram_4",
    label: "Memory stick 4",
    summary: "Slot 4, the second slot to fill in a two-stick kit.",
    whyItMatters:
      "If it is skipped in a two-stick kit, the sticks share one channel and the memory runs at half its bandwidth. A tall heatspreader on this stick can collide with the cooler's fan clip.",
    funFact: "Games with big open worlds are among the workloads that gain most from quick memory.",
  },
  gpu: {
    id: "gpu",
    label: "Graphics card",
    group: "graphics",
    summary: "A second computer dedicated to drawing the picture on your screen.",
    function:
      "It has its own processor, its own fast memory and its own cooling fans, and plugs into the top PCIe x16 slot. Power comes from the slot plus one or more cables from the supply. Its output ports at the back go to the monitor.",
    whyItMatters:
      "A card that is too long or too thick will not fit the case, and one without its power cables plugged in will not display anything. A weak supply can make the whole PC shut down mid-game.",
    funFact: "A high-end graphics card can draw more power than the rest of the PC put together.",
    stats: [
      { label: "Board power", value: "200 to 450 W" },
      { label: "Video memory", value: "12 to 24 GB" },
      { label: "Memory bandwidth", value: "500 to 1,000 GB/s" },
      { label: "Slot bandwidth", value: "PCIe 5.0 x16, 63 GB/s" },
    ],
    sources: [`${WIKI}Graphics_card`, `${WIKI}PCI_Express`],
  },
  psu: {
    id: "psu",
    label: "Power supply",
    group: "power",
    summary: "The box that turns wall power into the steady low voltages every part needs.",
    function:
      "It converts mains AC into 12 V, 5 V and 3.3 V, and sends it out through a bundle of cables. A larger wattage gives headroom when the CPU and graphics card are both working hard. Its efficiency tier says how much wall power is lost as heat.",
    whyItMatters:
      "An undersized supply causes random shutdowns under load, exactly when the game gets busy. Too few connectors means the graphics card or the CPU cannot be powered at all.",
    funFact: "Many supplies keep their fan off entirely at light loads, so an idle desktop can be completely silent.",
    stats: [
      { label: "Typical rating", value: "750 W" },
      { label: "Efficiency", value: "80 Plus Gold, 87 to 90%" },
      { label: "Sizing rule", value: "(CPU + GPU watts) x 1.3" },
      { label: "Form factor", value: "ATX or SFX" },
    ],
    sources: [`${WIKI}Power_supply_unit_(computer)`, `${WIKI}80_Plus`],
  },
  nvme: {
    id: "nvme",
    label: "NVMe SSD (M.2)",
    group: "storage",
    summary: "A stick-sized solid state drive that plugs straight into the motherboard.",
    function:
      "It sits in an M.2 slot and talks to the CPU over PCIe lanes rather than through a cable. It holds the operating system, your games and their loading data. A metal heatsink keeps the controller cool.",
    whyItMatters:
      "Fit the graphics card first and it may cover the M.2 slot, so this drive is easiest to install early. Skip the heatsink on a fast drive and it can throttle its own speed to protect itself.",
    funFact: "Fast PCIe 5.0 drives often ship with a heatsink because the controller gets hot enough to slow down.",
    stats: [
      { label: "PCIe 4.0 drive", value: "about 7,000 MB/s read" },
      { label: "PCIe 5.0 drive", value: "up to 14,000 MB/s read" },
      { label: "Size", value: "22 x 80 mm (2280)" },
    ],
    sources: [`${WIKI}NVM_Express`, `${WIKI}M.2`],
  },
  ssd_sata: {
    id: "ssd_sata",
    label: "SATA SSD (2.5 in)",
    group: "storage",
    summary: "A slower, cheaper solid state drive for bulk storage.",
    function:
      "It screws into a bracket behind the motherboard tray and connects with a data cable and a power cable. It is limited by the SATA link to a few hundred megabytes a second. It is a good home for games you do not play often.",
    whyItMatters:
      "If the data cable or the power cable is missing, the drive is invisible to the operating system and looks as if it was never fitted. Put your main games on it and loading takes noticeably longer than on NVMe.",
    funFact: "SATA III dates from 2009, and its ceiling of about 550 MB/s in practice has not moved since.",
    stats: [
      { label: "Link speed", value: "6 Gb/s (SATA III)" },
      { label: "Real throughput", value: "about 550 MB/s" },
      { label: "Thickness", value: "7 mm" },
    ],
    sources: [`${WIKI}Serial_ATA`],
  },
  fan_front: {
    id: "fan_front",
    label: "Front intake fan",
    group: "cooling",
    summary: "A fan that pulls cool room air into the front of the case.",
    function:
      "It sits behind the front panel and blows air across the drives and toward the graphics card. A four-pin cable lets the motherboard change its speed. Arrows on the frame show which way the air moves.",
    whyItMatters:
      "Mounted backwards, it blows hot air out of the front and fights the rear fan, so the whole case heats up. If a cable touches the blades it stops, and the parts behind it run hot.",
    funFact: "A 140 mm fan can move the same air as a 120 mm one at lower speed, which is why big fans are quieter.",
    stats: [
      { label: "Size", value: "120 or 140 mm" },
      { label: "Airflow", value: "50 to 70 CFM" },
      { label: "Noise", value: "20 to 30 dBA" },
      { label: "Speed control", value: "4-pin PWM, 25 kHz" },
    ],
    sources: [`${WIKI}Computer_fan`],
  },
  fan_rear: {
    id: "fan_rear",
    label: "Rear exhaust fan",
    group: "cooling",
    summary: "A fan that pushes hot air out of the back of the case.",
    function:
      "It sits behind the CPU cooler and pulls the warm air that has already crossed the components out of the case. Hot air also rises, so an exhaust at the top and back works with that. Its speed follows the CPU temperature on most boards.",
    whyItMatters:
      "Without it the warm air pools behind the CPU cooler and the CPU temperature climbs. Fitted the wrong way round, it fights the front fan and throws away most of the airflow.",
    funFact: "Hot air rises, so exhausting at the top and rear works with physics rather than against it.",
    stats: [
      { label: "Size", value: "120 mm" },
      { label: "Speed", value: "500 to 1,800 RPM" },
      { label: "Speed control", value: "4-pin PWM" },
    ],
    sources: [`${WIKI}Computer_fan`, `${WIKI}Computer_cooling`],
  },
  cables: {
    id: "cables",
    label: "Power and data cables",
    group: "power",
    summary: "The bundle of leads that carry power from the supply to the board, CPU, graphics card and drives.",
    function:
      "A 24-pin lead powers the motherboard, an 8-pin EPS lead powers the CPU, PCIe leads power the graphics card, and thin SATA leads power the drives. Each plug is keyed so that it only goes in one way. Routing them behind the tray keeps the airflow clear.",
    whyItMatters:
      "A missing EPS lead means the machine will not start at all, and a missing graphics lead leaves the screen black. Forcing the wrong lead into the wrong socket can damage parts, which is why the connectors are keyed.",
    funFact: "Modular cables are not interchangeable between brands, because the pinout at the supply end can differ even when the plugs match.",
    stats: [
      { label: "Main lead", value: "24 pins" },
      { label: "CPU lead (EPS)", value: "8 pins (4+4)" },
      { label: "PCIe 8-pin lead", value: "150 W" },
      { label: "PCIe slot", value: "75 W" },
    ],
    sources: [`${WIKI}ATX`, `${WIKI}Power_supply_unit_(computer)`],
  },
};

export const pcGroups: Record<string, { label: string; blurb: string }> = {
  chassis: {
    label: "Chassis",
    blurb: "The frame and panels. They set what fits, how air flows and how quiet the machine is.",
  },
  board: {
    label: "Board",
    blurb: "The motherboard connects everything and decides which parts are compatible.",
  },
  compute: {
    label: "Compute",
    blurb: "The CPU, its cooler and the memory: the parts that do the general thinking.",
  },
  graphics: {
    label: "Graphics",
    blurb: "The card that draws the frames, and the biggest single draw on power.",
  },
  storage: {
    label: "Storage",
    blurb: "Where the system and the games live, from fast NVMe to bulk SATA.",
  },
  power: {
    label: "Power",
    blurb: "The supply and the cables that carry its output to every other part.",
  },
  cooling: {
    label: "Cooling",
    blurb: "Case fans that move cool air in and hot air out.",
  },
};

/** The name `npm run check:sidecar` looks for in every `<feature>.copy.ts`. */
export const copyBook: CopyBook = pcCopy;
