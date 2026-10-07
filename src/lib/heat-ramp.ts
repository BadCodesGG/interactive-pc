/**
 * The heat overlay's colours: a cool, a warm and a hot stop per theme, blended by a part's heat (0 to
 * 1, from src/data/thermal.ts). Light uses deeper colours that hold on the white backdrop; dark uses
 * lifted ones that hold on graphite. The legend and the tint read the same stops, so they cannot drift.
 * Plain data and arithmetic: no three, no React.
 */
import type { Looks, Theme } from "@/engine/explode";

export const HEAT_STOPS: Record<Theme, [string, string, string]> = {
  light: ["#2f6fb5", "#e8a13a", "#c8321f"],
  dark: ["#58b7e0", "#ffc24d", "#ff5a47"],
};

/** How far a part's own colour gives way to the heat colour: a cool part stays itself, a hot one is mostly heat. */
export const HEAT_AMOUNT = { min: 0.35, max: 0.95 };

/**
 * The heat values the ramp is spread over. A build's parts sit between about 0.25 and 0.62 of the model's
 * scale, so the full ramp is stretched across that band: otherwise every part reads as the same orange.
 */
export const HEAT_BAND = { from: 0.25, to: 0.62 };

/** A heat value as a position on the ramp, 0 to 1. */
export const rampPosition = (heat: number) => Math.min(1, Math.max(0, (heat - HEAT_BAND.from) / (HEAT_BAND.to - HEAT_BAND.from)));

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** The colour for a heat value, blended between the theme's stops. */
export function heatColor(heat: number, theme: Theme): string {
  const t = Number.isFinite(heat) ? Math.min(1, Math.max(0, heat)) : 0;
  const stops = HEAT_STOPS[theme];
  const [from, to, u] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * u));
}

/** The heat of the installed parts only (null means all of them): a loose part keeps its own look. */
export function onlyInstalled(heat: Record<string, number>, installed: ReadonlySet<string> | null): Record<string, number> {
  return installed === null ? heat : Object.fromEntries(Object.entries(heat).filter(([id]) => installed.has(id)));
}

/** The engine's looks for a heat map: every part that makes heat is tinted, the rest are left as modelled. */
export function heatLooks(heat: Record<string, number>, theme: Theme): Looks {
  const parts: Looks["parts"] = {};
  for (const [id, h] of Object.entries(heat)) {
    if (!(h > 0)) continue;
    const t = rampPosition(h);
    parts[id] = { tint: heatColor(t, theme), amount: HEAT_AMOUNT.min + (HEAT_AMOUNT.max - HEAT_AMOUNT.min) * t };
  }
  return { parts };
}

/** The legend's bar. */
export function heatGradient(theme: Theme): string {
  return `linear-gradient(to right, ${HEAT_STOPS[theme].join(", ")})`;
}
