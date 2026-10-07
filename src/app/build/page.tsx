import type { Metadata } from "next";
import { ExplodeProvider } from "@/engine/explode";
import { initialBuild } from "@/lib/share-build";
import { pageMetadata } from "@/lib/site";
import { BuildGame } from "./build-game";

export const metadata: Metadata = pageMetadata({
  title: "Build the PC",
  description: "Build a gaming PC step by step: pick each part from the tray and fit it in the right order, from the power supply to the first boot.",
  path: "/build",
});

/**
 * The build game. The tray, the step bar, the spec sheet and every action render on the server and
 * work from the keyboard; the 3D scene is a lazy enhancement on top. Same frame as the exploded page:
 * the stage column with the heading, the spec sheet beside it.
 *
 * A shared build (`?b=`) is read here, on the server, so the sheet arrives with the picks in it and
 * nothing flashes or mismatches on hydration. A bad or tampered value is the shipped build.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { picks, mode, shared } = initialBuild(await searchParams);
  return (
    <ExplodeProvider>
      <main className="mx-auto max-w-7xl px-4 py-6 pb-10 md:px-6">
        <BuildGame
          initialPicks={picks}
          initialMode={mode}
          initialShared={shared}
          header={
            <header className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">Build it yourself · 19 steps</p>
              <h1 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">Build the PC</h1>
              <p className="sr-only">
                Pick a part from the tray, then click the glowing outline where it goes, or drag it there. The order matters: a part that goes in too early is
                refused, and the game says why.
              </p>
            </header>
          }
        />
      </main>
    </ExplodeProvider>
  );
}
