/**
 * Where things sit in the build scene, as pure numbers (model units, 1 = 100 mm). The scene reads
 * these; nothing here imports three, so the DOM layer can use it too.
 */
import { createGame, trayParts, type GameState } from "./machine";

type V3 = [number, number, number];

/** Tray order: the order the parts are first needed in. Each part keeps its spot as others leave. */
export const TRAY_ORDER: string[] = trayParts(createGame());

/** The arc the tray parts stand on: centred in front of the case, sweeping round both sides. */
const ARC = { centre: [0, 0, 0.4] as V3, radius: 4.8, from: -115, to: 115 };

export function trayPosition(partId: string): V3 {
  const i = Math.max(0, TRAY_ORDER.indexOf(partId));
  const t = TRAY_ORDER.length > 1 ? i / (TRAY_ORDER.length - 1) : 0.5;
  const a = ((ARC.from + t * (ARC.to - ARC.from)) * Math.PI) / 180;
  // Angle 0 is straight out of the front; negative angles run round the glass (left, -x) side,
  // where the first steps are, so the order reads left to right from the default camera.
  return [ARC.centre[0] + ARC.radius * Math.sin(a), 0, ARC.centre[2] + ARC.radius * Math.cos(a)];
}

/** Parts that are fitted to the board on the bench before it goes into the case. */
const BENCH_PARTS = new Set(["motherboard", "cpu", "ram_1", "ram_2", "ram_3", "ram_4", "nvme"]);

/** Where the bench is, relative to the board's place in the case: out to the left, in front. */
export const BENCH_OFFSET: V3 = [-3.3, 0, 1.4];

export const isBenchPart = (partId: string) => BENCH_PARTS.has(partId);

/** Offset added to a part's slot (placed or ghost) right now: the bench offset until the board is in. */
export function displayOffset(s: GameState, partId: string): V3 {
  return isBenchPart(partId) && !s.placed.has("board_case") ? BENCH_OFFSET : [0, 0, 0];
}
