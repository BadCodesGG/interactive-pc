"use client";

/**
 * The game's sounds, on the engine's audio (src/engine/explode/audio.ts): WebAudio tones with no
 * files, a lazy AudioContext that starts only after a click or key press, and one mute switch that is
 * off by default and remembered. This file keeps only what is the game's own: which cue plays when,
 * and the POST beep's pitch from `feedback.postBeep`. The exploded page shares the same switch.
 */
import { feedback } from "@/data/assembly";
import { getSound } from "@/engine/explode";

/** The one Sound for the whole PC app; the mute toggle in the tray and the exploded page both drive it. */
export const sound = () => getSound("pc");

/** The healthy-machine POST: the short beep from `feedback.postBeep`, then a short high chirp. */
export function playPostBeep() {
  const { frequencyHz, durationMs } = feedback.postBeep;
  const beep = durationMs / 1000;
  sound().play([
    { hz: frequencyHz, at: 0.05, dur: beep },
    { hz: frequencyHz * 1.5, at: 0.05 + beep + 0.12, dur: 0.08 },
  ]);
}

/** A low thunk when a part seats. */
export function playSnap() {
  sound().play("snap");
}

/** A dull knock when a part is refused. */
export function playReject() {
  sound().play("reject");
}
