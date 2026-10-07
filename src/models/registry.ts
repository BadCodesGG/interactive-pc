/**
 * Models built in code rather than loaded from a GLB. A sidecar whose `model` is
 * `"procedural:<name>"` is resolved here by the engine's loader, and by `npm run check:sidecar`.
 *
 * Every entry is a dynamic import, so this file costs nothing in a route's initial JS: the
 * generator (and three with it) is fetched only when the stage asks for the model.
 * Imports are relative, not `@/`, so the sidecar check can load this file under tsx.
 */
import type { Object3D } from "three";

export interface ProceduralModel {
  root: Object3D;
  /** Every part node name, in sidecar order: the check compares it with the sidecar's keys. */
  partNames: string[];
}

export const proceduralModels: Record<string, () => Promise<() => ProceduralModel>> = {
  pc: () => import("./pc/build-pc").then((m) => m.buildPc),
};

export const PROCEDURAL_PREFIX = "procedural:";

/** The registry name in a `procedural:<name>` model URL, or null for an ordinary URL. */
export function proceduralName(url: string): string | null {
  return url.startsWith(PROCEDURAL_PREFIX) ? url.slice(PROCEDURAL_PREFIX.length) : null;
}

/** Finds the generator for a procedural model name, failing with the name in the message. */
export async function loadProcedural(name: string): Promise<() => ProceduralModel> {
  const entry = proceduralModels[name];
  if (!entry) throw new Error(`No procedural model "${name}" in src/models/registry.ts`);
  return entry();
}
