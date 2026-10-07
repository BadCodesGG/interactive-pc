import type { Metadata } from "next";
import { BuildSheet } from "@/components/build-sheet";
import { pcCopy, pcSidecar } from "@/data/pc";
import { DeepLinkSync, ExplodeControls, ExplodeProvider, InfoPanel, PartList, StageTools, XrayControl } from "@/engine/explode";
import { defaultPickIds } from "@/data/showcase";
import { pageMetadata } from "@/lib/site";
import { StageClient } from "./stage-client";
import { StageOverlays } from "./stage-overlays";
import { STAGE_ACCENT, STAGE_BACKGROUND, STAGE_PALETTE, STAGE_RENDER } from "./stage-look";

export const metadata: Metadata = pageMetadata({
  title: "A gaming PC, taken apart",
  description: "Pull a gaming PC apart in 3D: the panels, the board, the CPU and its cooler, memory, graphics card, drives, power and fans. Pick any part to read what it does.",
  path: "/",
});

/** From the front left, looking through the glass side at the board. */
const ANGLES: [number, number] = [-0.62, 1.12];
const FILL: [number, number, number] = [9, 3, 5];
/**
 * The model's unit is 100 mm, so View in AR scales it by 0.1 to metres. Its 184k triangles would make
 * a 35 MB USDZ (the limit is 20), so the phone's copy keeps 30% of them, within 0.8% of each mesh's
 * size (2 mm on a 25 cm board): about 14 MB. The stage is not touched.
 */
const PC_AR = { metresPerUnit: 0.1, simplify: { keep: 0.3, error: 0.008 } };

/**
 * The exploded PC as a configurator: the machine on a seamless backdrop, its spec sheet beside it.
 * Server-rendered: the headline, the sheet and the grouped part list are in the HTML, so the page
 * reads and indexes with JavaScript off. Only the canvas is client-only and lazy.
 */
export default function Page() {
  return (
    <ExplodeProvider>
      <DeepLinkSync sidecar={pcSidecar} />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <header className="flex max-w-3xl flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">Gaming PC · 18 parts</p>
              <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.02em] text-ink md:text-[40px] md:leading-[46px]">
                A gaming PC, taken apart
              </h1>
              <p className="text-[15px] leading-[22px] text-ink-secondary">
                Press Explode to pull the machine apart in three stages: the panels, then the card, drives, power and fans, then
                the cooler, memory and CPU off the board. Pick a part in the view or on the sheet to read what it does.
              </p>
            </header>
            <div className="relative">
            <StageClient
              sidecar={pcSidecar}
              initialAngles={ANGLES}
              palette={STAGE_PALETTE}
              frame={[1.05, 0.8]}
              fillFrom={FILL}
              fillIntensity={0.9}
              background={STAGE_BACKGROUND}
              accent={STAGE_ACCENT}
              render={STAGE_RENDER}
              finish="pc"
              ar={PC_AR}
              power
              opening
              className="stage-backdrop border-0 h-[max(18rem,calc(100dvh_-_28rem))] md:h-[clamp(420px,calc(100dvh_-_22.75rem),660px)]"
              poster={{
                label: "A mid-tower gaming PC with a glass side panel: motherboard, tower cooler, four memory sticks, graphics card and power supply inside",
                // Not the eyebrow above the heading again: under reduced motion the poster is what the visitor sees first.
                title: "Exploded view",
                detail: "Explode it in three stages, then pick any part to read what it does.",
              }}
            />
            <StageOverlays picks={defaultPickIds} power />
            </div>
            <ExplodeControls className="rounded-xl border border-border bg-surface px-4 py-3">
              <StageTools app="pc" sidecar={pcSidecar} ar />
            </ExplodeControls>
            <InfoPanel sidecar={pcSidecar} copy={pcCopy} facts />
          </div>
          <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
            <BuildSheet />
            <XrayControl sidecar={pcSidecar} className="rounded-xl border border-border bg-surface px-5 py-3" />
            <details className="rounded-xl border border-border bg-surface px-5 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Every part, by system</summary>
              <nav aria-label="Parts of the PC" className="mt-4">
                <PartList sidecar={pcSidecar} copy={pcCopy} search filter discover="pc" />
              </nav>
            </details>
          </aside>
        </div>
      </main>
    </ExplodeProvider>
  );
}
