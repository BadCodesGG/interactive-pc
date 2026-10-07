export interface Credit {
  name: string;
  author: string;
  licence: string;
  url: string;
  /** Text to show. For MIT this carries the copyright notice the licence requires. */
  line: string;
}

export const credits: Credit[] = [
  {
    name: "pc-anatomy",
    author: "Yoseph (GitHub: Yoosseph)",
    licence: "MIT",
    url: "https://github.com/Yoosseph/pc-anatomy",
    line: "PC part geometry generators adapted from pc-anatomy by Yoosseph (https://github.com/Yoosseph/pc-anatomy), Copyright (c) 2026 Yoseph, MIT License.",
  },
];

/** The single attribution line for a footer or credits page. */
export const creditsLine: string = credits.map((credit) => credit.line).join(" ");
