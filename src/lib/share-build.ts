/**
 * The share-build codec: a build's picks as one short URL parameter, and back.
 *
 * Format: for each picked slot, one slot letter and one base 36 digit, the digit being the index of
 * the pick in `byKind(kind)`. The default build is `c0m0u0k1r1g2p1n1s0f1` (20 characters).
 *
 * The URL is untrusted input, so decoding is an allow-list and nothing else:
 * - a value is used only if it is a string of at most MAX_SHARE_LENGTH lowercase letters and digits;
 *   anything else, including an oversize value, decodes to nothing;
 * - each two character entry must name a known slot letter and an index inside that slot's own
 *   catalogue list, otherwise it is dropped; a slot given twice keeps its first entry;
 * - the output is built from the catalogue's own ids, so no character of the input reaches it, and it
 *   is never used as HTML or a selector;
 * - slot lookups use a Map and arrays, never `obj[userText]`, and there is no decodeURIComponent or
 *   atob to throw.
 * The index is the code, so the order of each kind in catalogue.ts is pinned by share-build.test.ts:
 * new parts are appended, never inserted.
 */
import { byKind, catalogueKinds, type CatalogueKind } from "@/data/catalogue";
import type { Picks } from "@/data/compat";
import type { ModeId } from "@/data/modes";
import { segmentKey } from "@/engine/explode/deep-link";
import { defaultPickIds } from "@/data/showcase";

export const SHARE_PARAM = "b";
/** Longer than any valid code (two characters per slot), so real codes pass and abuse does not. */
export const MAX_SHARE_LENGTH = 64;

export const SLOT_KEYS: Record<CatalogueKind, string> = {
  case: "c",
  motherboard: "m",
  cpu: "u",
  cooler: "k",
  ram: "r",
  gpu: "g",
  nvme: "n",
  ssd: "s",
  psu: "p",
  fan: "f",
};

const KIND_BY_KEY = new Map<string, CatalogueKind>(catalogueKinds.map((kind) => [SLOT_KEYS[kind], kind]));
const SAFE = /^[a-z0-9]*$/;

/** The picks as a parameter value. A pick that is not in its slot's list is left out. */
export function encodePicks(picks: Partial<Record<CatalogueKind, string>>): string {
  let code = "";
  for (const kind of catalogueKinds) {
    const id = picks[kind];
    const index = byKind(kind).findIndex((item) => item.id === id);
    if (index >= 0) code += SLOT_KEYS[kind] + index.toString(36);
  }
  return code;
}

/** A parameter value as picks. Never throws; unknown, duplicate and malformed entries are dropped. */
export function decodePicks(raw: unknown): Partial<Picks> {
  // A repeated ?b=...&b=... arrives as an array: the first one counts.
  const value = Array.isArray(raw) ? raw[0] : raw;
  const out: Partial<Picks> = {};
  if (typeof value !== "string" || value.length > MAX_SHARE_LENGTH || !SAFE.test(value)) return out;
  for (let i = 0; i + 1 < value.length; i += 2) {
    const kind = KIND_BY_KEY.get(value[i]);
    if (!kind || out[kind] !== undefined) continue;
    const item = byKind(kind)[Number.parseInt(value[i + 1], 36)];
    if (item) out[kind] = item.id;
  }
  return out;
}

/** Decoded picks with every missing slot filled from the shipped build. */
export function withDefaults(picks: Partial<Picks>): Picks {
  return { ...defaultPickIds, ...picks };
}

/**
 * A search string with the build in it: `b` is set in place of its first appearance (or removed for the
 * shipped build) and every other parameter stays byte for byte, in order, as the engine's deep links do.
 * Returns "" or a string that starts with "?".
 */
export function withSharedPicks(search: string, picks: Picks): string {
  const segments = search.replace(/^\?/, "").split("&").filter((seg) => seg !== "");
  const at = segments.findIndex((seg) => segmentKey(seg) === SHARE_PARAM);
  const kept = segments.filter((seg) => segmentKey(seg) !== SHARE_PARAM);
  const code = encodePicks(picks);
  if (code !== encodePicks(defaultPickIds)) kept.splice(at < 0 ? kept.length : at, 0, `${SHARE_PARAM}=${code}`);
  return kept.length ? `?${kept.join("&")}` : "";
}

/** The page's own address with the build in it, keeping the path, the other parameters and the hash. */
export function shareHref(loc: Pick<Location, "origin" | "pathname" | "search" | "hash">, picks: Picks): string {
  return `${loc.origin}${loc.pathname}${withSharedPicks(loc.search, picks)}${loc.hash}`;
}

/**
 * The /build page's first state from its address. A missing, bad or tampered parameter is the shipped
 * build in Guided, silently; a shared build opens Free, where its rows can be swapped, and says it is
 * `shared` so the page can tell the visitor where the build came from.
 */
export function initialBuild(params: Record<string, string | string[] | undefined>): { picks: Picks; mode: ModeId; shared: boolean } {
  const picks = withDefaults(decodePicks(params[SHARE_PARAM]));
  const shipped = encodePicks(picks) === encodePicks(defaultPickIds);
  return { picks, mode: shipped ? "guided" : "free", shared: !shipped };
}
