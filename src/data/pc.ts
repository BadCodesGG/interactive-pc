import { parseSidecar } from "@/engine/explode/sidecar";
import json from "./pc.sidecar.json";

/** The PC's sidecar, validated at build time: a malformed sidecar fails `next build`. */
export const pcSidecar = parseSidecar(json, "pc.sidecar.json");
export { copyBook as pcCopy } from "./pc.copy";
