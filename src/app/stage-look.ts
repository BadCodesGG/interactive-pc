/**
 * The PC stage's look in both themes, shared by the explode page and /build. Plain data with no
 * three import, so a server component (page.tsx) may pass it to the client stage.
 *
 * Light is the approved product shot: a bright white backdrop, the key from the front left. Dark is
 * a deep graphite seamless (the page's own ground, #101214) with a soft pool of light behind the
 * case, lit by a cooler, dimmer key and rim lights that lift the case's edges off it.
 */
import type { RenderProp, StagePalette, Themed } from "@/engine/explode";

export const STAGE_PALETTE: Themed<Partial<StagePalette>> = {
  light: {
    sky: "#ffffff",
    ground: "#c9ced4",
    hemisphere: 1.5,
    key: "#ffffff",
    keyIntensity: 2.9,
    keyFrom: [-1.1, 1.9, 1.2],
    shadow: "#14161a",
    shadowOpacity: 0.2,
  },
  dark: {
    sky: "#9aa6b6",
    ground: "#1a1d20",
    hemisphere: 1.4,
    key: "#e6eef7",
    keyIntensity: 2.8,
    keyFrom: [-1.1, 1.9, 1.2],
    shadow: "#000000",
    shadowOpacity: 0.55,
    rim: "#cfe3ee",
    rimIntensity: 0.6,
  },
};

/** The page ground per theme (--ground): also what isolated-out parts fade toward. */
export const STAGE_BACKGROUND = { light: "#f4f5f6", dark: "#101214" };
/** The accent per theme (--pcb): slot highlights, selection and hover glow. */
export const STAGE_ACCENT = { light: "#0b6b70", dark: "#3cc3c3" };

/**
 * Image-based light from the studio room, PBR reflections in the metal and glass, neutral tone
 * mapping (it keeps the design's colours), ambient occlusion inside the case and a contact shadow
 * under it. Dark has less environment, so the interior sits in the dark and the RGB carries it.
 */
export const STAGE_RENDER: RenderProp = {
  light: {
    env: true,
    envIntensity: 0.6,
    toneMapping: "neutral",
    exposure: 1.25,
    ao: { radius: 0.05, intensity: 3, distanceFalloff: 1 },
    contact: { opacity: 0.32, blur: 3, far: 0.35 },
    shadowMapSize: 2048,
    shadowRadius: 4,
  },
  dark: {
    env: true,
    envIntensity: 0.55,
    toneMapping: "neutral",
    exposure: 1.5,
    ao: { radius: 0.045, intensity: 2.6, distanceFalloff: 1 },
    contact: { opacity: 0.6, blur: 3, far: 0.35 },
    shadowMapSize: 2048,
    shadowRadius: 4,
  },
};
