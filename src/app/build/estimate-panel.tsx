"use client";

import { useMemo } from "react";
import { getItem } from "@/data/catalogue";
import type { Picks } from "@/data/compat";
import { ESTIMATE_DISCLAIMER, RESOLUTIONS, estimateTable, type Verdict } from "@/data/run-estimate";
import { cn } from "@/lib/utils";

const VERDICT_LABEL: Record<Verdict, string> = { struggles: "Struggles", playable: "Playable", smooth: "Smooth", fast: "Fast" };
const VERDICT_TEXT: Record<Verdict, string> = { struggles: "text-error", playable: "text-caution", smooth: "text-accent", fast: "text-accent" };

/**
 * What will it run: frames per second by game genre and resolution for the picked CPU and GPU.
 * The estimate says, in words and on screen, that the parts and the genres are invented.
 */
export function EstimatePanel({ picks }: { picks: Picks }) {
  const rows = useMemo(() => estimateTable({ cpu: picks.cpu, gpu: picks.gpu }), [picks.cpu, picks.gpu]);
  return (
    <div data-estimate className="flex flex-col gap-3 px-5 pb-2">
      <p className="text-[15px] leading-[22px] text-ink">
        <span className="font-semibold">{getItem(picks.cpu).name}</span> with <span className="font-semibold">{getItem(picks.gpu).name}</span>
      </p>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Estimated frames per second by game genre and resolution</caption>
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">
            <th scope="col" className="pb-2 font-semibold">
              Genre
            </th>
            {RESOLUTIONS.map((r) => (
              <th key={r.id} scope="col" className="pb-2 text-right font-semibold">
                {r.label}
                <span className="block font-medium normal-case tracking-normal">fps</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ genre, cells }) => (
            <tr key={genre.id} data-estimate-row={genre.id} className="border-t border-border align-top">
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                <span className="block text-sm font-semibold text-ink">{genre.label}</span>
              </th>
              {cells.map((c) => (
                <td key={c.resolution} data-fps={c.fps} data-verdict={c.verdict} className="py-2 pl-2 text-right">
                  <span className="block text-sm font-bold tabular-nums text-ink">{c.fps}</span>
                  <span className={cn("block text-xs leading-4 font-semibold", VERDICT_TEXT[c.verdict])}>
                    {VERDICT_LABEL[c.verdict]}
                    <span className="sr-only">, held back by the {c.limitedBy === "cpu" ? "processor" : "graphics card"}</span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-estimate-disclaimer className="text-xs text-ink-secondary">
        {ESTIMATE_DISCLAIMER} Frames per second, from the processor and the graphics card only.
      </p>
    </div>
  );
}
