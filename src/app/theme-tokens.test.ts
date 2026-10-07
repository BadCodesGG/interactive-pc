import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

/** The custom properties declared in one rule, by selector. */
function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
}

const light = declarations(":root");
const dark = { ...light, ...declarations('[data-theme="dark"]') };

/** A token's value with any var(--x) chain followed to a hex colour. */
function resolve(theme: Record<string, string>, name: string): string {
  let v = theme[name];
  for (let i = 0; i < 5 && v?.startsWith("var("); i++) v = theme[v.slice(4, -1)];
  expect(v, name).toMatch(/^#[0-9a-f]{6}$/i);
  return v;
}

const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio]: 4.5 for text, 3 for icons, borders of controls and the focus ring. */
const PAIRS: [string, string, number][] = [
  ["--ink", "--bg", 4.5],
  ["--ink", "--surface", 4.5],
  ["--ink", "--surface-hover", 4.5],
  ["--ink-secondary", "--bg", 4.5],
  ["--ink-secondary", "--surface", 4.5],
  ["--ink-secondary", "--surface-hover", 4.5],
  ["--ink-tertiary", "--bg", 4.5],
  ["--ink-tertiary", "--surface", 4.5],
  ["--accent", "--bg", 4.5],
  ["--accent", "--surface", 4.5],
  ["--accent", "--surface-hover", 4.5],
  ["--ink", "--accent-soft", 4.5],
  ["--accent", "--accent-soft", 4.5],
  // Text on an accent fill: the primary button and the selected difficulty.
  ["--ink-inverted", "--accent", 4.5],
  ["--ink-inverted", "--accent-hover", 4.5],
  ["--bg", "--accent", 4.5],
  ["--ink-inverted", "--surface-inverted", 4.5],
  ["--ink-inverted-secondary", "--surface-inverted", 4.5],
  ["--caution", "--bg", 4.5],
  ["--caution", "--surface", 4.5],
  ["--error", "--bg", 4.5],
  ["--error", "--surface", 4.5],
  ["--ink-inverted", "--error", 4.5],
  // The focus ring and the outline on a control.
  ["--accent", "--bg", 3],
  ["--accent", "--surface", 3],
  // The edge of the part search and the theme toggle, on the page, a panel and a hovered row.
  ["--field-border", "--bg", 3],
  ["--field-border", "--surface", 3],
  ["--field-border", "--surface-hover", 3],
];

describe("theme tokens", () => {
  it("defines every custom property the dark theme needs, with no property that is not in :root", () => {
    const overrides = declarations('[data-theme="dark"]');
    for (const name of Object.keys(overrides)) expect(light, `${name} is in :root`).toHaveProperty([name]);
    // Only these stay shared: they are references (var) or the same in both themes.
    const shared = Object.keys(light).filter((n) => !(n in overrides));
    for (const name of shared) expect(light[name], `${name} must be a reference if the dark theme does not set it`).toMatch(/^var\(/);
  });

  it("keeps the light theme on its ground, surface, teal and ink tokens", () => {
    expect(resolve(light, "--ground")).toBe("#f4f5f6");
    expect(resolve(light, "--surface")).toBe("#ffffff");
    expect(resolve(light, "--pcb")).toBe("#0b6b70");
    expect(resolve(light, "--ink")).toBe("#14161a");
  });

  it("sets the dark theme to its own ground, surface, teal and status tokens", () => {
    const expected: Record<string, string> = {
      "--ground": "#101214",
      "--surface": "#1a1d20",
      "--line": "#2d3136",
      "--ink": "#eef0f2",
      "--ink-secondary": "#a3aab5",
      "--pcb": "#3cc3c3",
      "--pcb-soft": "#0f2e30",
      "--caution": "#f0b54a",
      "--error": "#ff8a80",
    };
    for (const [name, hex] of Object.entries(expected)) expect(resolve(dark, name), name).toBe(hex);
    expect(resolve(dark, "--bg")).toBe("#101214");
    expect(resolve(dark, "--accent")).toBe("#3cc3c3");
  });

  for (const [themeName, theme] of [["light", light], ["dark", dark]] as const) {
    it(`meets WCAG AA for every text and control pair in the ${themeName} theme`, () => {
      for (const [fg, bg, min] of PAIRS) {
        const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
        expect(ratio, `${fg} on ${bg} (${resolve(theme, fg)} on ${resolve(theme, bg)})`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
