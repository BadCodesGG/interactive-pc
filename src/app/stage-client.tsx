"use client";

import dynamic from "next/dynamic";
import { StageGate, useExplodeState, useExplodeStore } from "@/engine/explode";
import "@/models/register";
import type { StageProps } from "./stage";

// three, R3F and camera-controls live only in these lazy chunks. `ssr: false` is allowed only in a
// Client Component, which is why this wrapper exists. They are requested after idle, only with
// WebGL 2, and under reduced motion only when the visitor presses Load 3D. The sibling
// `import("three")` gives three its own chunk (shared and cached across every feature route) that
// downloads in parallel with the stage's own code, instead of being bundled into it.
const Stage = dynamic(() => Promise.all([import("./stage"), import("three")]).then(([stage]) => stage), { ssr: false });

/**
 * What the stage shows before, or instead of, the 3D scene. `label` is the picture's alt text; `title`
 * and `detail` are what this route's stage is for, in the top corner so the gate's own controls keep
 * the middle. They are per route: /build has no exploded view, so it must not say so.
 */
export function Poster({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-full w-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_60%)]"
    >
      <div className="absolute top-4 left-4 flex max-w-[16rem] flex-col gap-1">
        <span className="font-display text-sm font-bold uppercase tracking-[0.12em] text-ink-secondary">{title}</span>
        <span className="text-xs leading-4 text-ink-secondary max-sm:hidden">{detail}</span>
      </div>
    </div>
  );
}

export function StageClient({ poster, className, ...stage }: StageProps & { poster: { label: string; title: string; detail: string }; className?: string }) {
  const store = useExplodeStore();
  const { ready, k, opening: flying } = useExplodeState(store);
  // data-stage-k is the explode amount at the last settle: npm run test:stage waits on it. The
  // opening fly-in holds data-stage-ready for its ~2 s, so a check or a screenshot sees the fitted pose.
  return (
    <div data-stage-ready={ready && !flying ? "true" : "false"} data-stage-k={k}>
      <StageGate className={className} poster={<Poster {...poster} />}>{(gate) => <Stage {...stage} {...gate} />}</StageGate>
    </div>
  );
}
