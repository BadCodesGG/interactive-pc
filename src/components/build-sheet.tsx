"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useExplodeState, useExplodeStore } from "@/engine/explode";
import { compatReport } from "@/data/compat";
import { defaultPickIds, rowFor, sheet, sheetTotal, usd } from "@/data/showcase";
import { cn } from "@/lib/utils";
import { KIND_ICON } from "./part-icons";

/** The same count /build's sheet shows for the same build, so the two pages never disagree about it. */
const shipped = compatReport(defaultPickIds);

/**
 * The configurator's spec sheet: one row per pick with its spec and example price, the running
 * total, and the compatibility verdict in words. Every row is a button that picks its part in 3D,
 * and a part picked in 3D lights its row. Server-rendered, so it reads with JavaScript off.
 */
export function BuildSheet({ className }: { className?: string }) {
  const store = useExplodeStore();
  const { selected } = useExplodeState(store);
  const active = selected ? rowFor(selected) : undefined;

  return (
    <section data-build-sheet aria-labelledby="build-sheet-title" className={cn("rounded-xl border border-border bg-surface", className)}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id="build-sheet-title" className="text-lg font-bold text-ink">
          This build
        </h2>
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">{sheet.length} parts</p>
      </header>
      <ul className="flex flex-col px-2">
        {sheet.map((row) => {
          const on = row === active;
          const Icon = KIND_ICON[row.kind];
          return (
            <li key={row.kind} className="border-t border-border first:border-t-0">
              <button
                type="button"
                aria-pressed={on}
                data-sheet-row={row.kind}
                onClick={() => store.select(on ? null : row.parts[0])}
                className={cn(
                  "grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-3 py-2 text-left transition-colors",
                  on ? "bg-accent-soft" : "hover:bg-surface-hover",
                )}
              >
                <Icon aria-hidden strokeWidth={1.5} className={cn("size-5", on ? "text-accent" : "text-ink-secondary")} />
                <span className="flex min-w-0 flex-col">
                  <span className={cn("truncate text-[15px] leading-[22px] font-semibold", on ? "text-accent" : "text-ink")}>
                    <span className="sr-only">{row.label}: </span>
                    {row.qty > 1 ? `${row.qty} x ${row.item.name}` : row.item.name}
                  </span>
                  <span className="truncate font-mono text-[13px] leading-[18px] text-ink-secondary">{row.spec}</span>
                </span>
                <span className="text-[15px] font-bold tabular-nums text-ink">{usd(row.item.priceUsd * row.qty)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <footer className="mt-2 flex flex-col gap-4 border-t border-border px-5 py-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent">
          <Check aria-hidden className="size-4" strokeWidth={2} />
          Fits
          <span className="font-normal text-ink-secondary">
            · {shipped.passed} of {shipped.total} compatibility checks pass
          </span>
        </p>
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold text-ink">Total</p>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight text-ink" data-sheet-total>
            {usd(sheetTotal)}
          </p>
        </div>
        <p className="-mt-3 text-xs text-ink-secondary">Example prices for invented parts.</p>
        <Link
          href="/build"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-bold text-ink-inverted transition-colors hover:bg-accent-hover"
        >
          Build it yourself
        </Link>
      </footer>
    </section>
  );
}
