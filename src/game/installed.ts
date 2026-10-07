/**
 * Which parts of the build scene are installed, for the heat overlay: heat on a part still standing on
 * the tray, or lying on the bench, means nothing. A part is installed once its place step is done, and
 * the parts that go on the board count only once the board is in the case.
 */
import { isBenchPart } from "./layout";
import { pendingStepFor, type GameState } from "./machine";

export function installedParts(s: GameState): Set<string> {
  const inCase = s.placed.has("board_case");
  const out = new Set<string>();
  for (const step of s.steps) {
    if (step.kind !== "place" || out.has(step.partId) || pendingStepFor(s, step.partId)) continue;
    if (isBenchPart(step.partId) && !inCase) continue;
    out.add(step.partId);
  }
  return out;
}
