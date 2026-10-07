"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleX, Link2, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KIND_ICON } from "@/components/part-icons";
import { getItem, type CatalogueKind } from "@/data/catalogue";
import { STATUS_LABEL, alternativesFor, compatReport, type CompatStatus, type Picks } from "@/data/compat";
import { picksTotal, sheet, specLine, usd } from "@/data/showcase";
import { copyText } from "@/engine/explode/capture";
import { shareHref } from "@/lib/share-build";
import { cn } from "@/lib/utils";
import { EstimatePanel } from "./estimate-panel";

const STATUS_ICON: Record<CompatStatus, LucideIcon> = { fits: Check, check: TriangleAlert, "wont-fit": CircleX };
const STATUS_TEXT: Record<CompatStatus, string> = { fits: "text-accent", check: "text-caution", "wont-fit": "text-error" };

/** The status as an icon and a word: colour is never the only signal. */
export function StatusMark({ status, className }: { status: CompatStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span data-compat-status={status} className={cn("inline-flex items-center gap-1 text-xs font-semibold", STATUS_TEXT[status], className)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Copies a link to this build: the page's address with the picks in it (src/lib/share-build.ts). */
function ShareButton({ picks }: { picks: Picks }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function share() {
    const result = await copyText(shareHref(window.location, picks));
    setState(result === "copied" ? "copied" : "manual");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2500);
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" data-share-build onClick={share} className={cn(state === "copied" && "border-accent text-accent")}>
        {state === "copied" ? <Check aria-hidden /> : <Link2 aria-hidden />}
        {state === "copied" ? "Link copied" : "Share build"}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? "Link to this build copied." : state === "manual" ? "Could not copy. The link is in the address bar." : ""}
      </span>
    </>
  );
}

type Tab = "parts" | "estimate";
const TABS: { id: Tab; label: string }[] = [
  { id: "parts", label: "Parts" },
  { id: "estimate", label: "What it runs" },
];

export interface SpecSheetProps {
  picks: Picks;
  onSwap: (kind: CatalogueKind, id: string) => void;
  /** The rows can be swapped for another part of their kind. */
  canSwap: boolean;
  /** Rules the tier keeps off the sheet (they still apply in the game). */
  hiddenRuleIds?: readonly string[];
  budgetUsd?: number;
  className?: string;
}

/**
 * /build's spec sheet: the hero's "This build" sheet with a compatibility status on every row
 * (Fits, Check or Won't fit, from the rules in src/data/rules.ts) and, where the mode lets the player
 * choose, a swap list per row that shows what each alternative would do to the status.
 * It owns no state but which row is open: the picks belong to the page.
 */
export function SpecSheet({ picks, onSwap, canSwap, hiddenRuleIds = [], budgetUsd, className }: SpecSheetProps) {
  const uid = useId();
  const [open, setOpen] = useState<CatalogueKind | null>(null);
  const [tab, setTab] = useState<Tab>("parts");
  const hidden = hiddenRuleIds.join(",");
  const report = useMemo(() => compatReport(picks, { hiddenRuleIds: hidden ? hidden.split(",") : [] }), [picks, hidden]);
  const total = picksTotal(picks);
  const failed = report.total - report.passed;
  // A tier that keeps a rule off the sheet says so, so its smaller count does not read as a different verdict on the same build.
  const scope = hiddenRuleIds.length > 0 ? "visible compatibility checks" : "compatibility checks";

  return (
    <section data-spec-sheet aria-labelledby={`${uid}-title`} className={cn("rounded-xl border border-border bg-surface", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 id={`${uid}-title`} className="text-lg font-bold text-ink">
            This build
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">{sheet.length} parts</p>
        </div>
        <ShareButton picks={picks} />
      </header>
      <div role="tablist" aria-label="Sheet view" className="mx-5 mb-2 flex gap-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel`}
            data-sheet-tab={t.id}
            onClick={() => setTab(t.id)}
            className={cn("-mb-px min-h-10 cursor-pointer border-b-2 text-sm font-semibold transition-colors", tab === t.id ? "border-accent text-accent" : "border-transparent text-ink-secondary hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
      {tab === "estimate" ? (
        <EstimatePanel picks={picks} />
      ) : (
      <>
      {canSwap && <p data-swap-hint className="mx-5 mb-1 text-xs leading-4 text-ink-secondary">Choose a row to swap its part. The 3D model stays the shipped build.</p>}
      <ul className="flex flex-col px-2">
        {sheet.map((row) => {
          const item = getItem(picks[row.kind]);
          const compat = report.rows[row.kind];
          const Icon = KIND_ICON[row.kind];
          const expanded = open === row.kind;
          const listId = `${uid}-${row.kind}`;
          const body = (
            <>
              <Icon aria-hidden strokeWidth={1.5} className={cn("size-5", compat.status === "fits" ? "text-ink-secondary" : STATUS_TEXT[compat.status])} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] leading-[22px] font-semibold text-ink">
                  <span className="sr-only">{row.label}: </span>
                  {row.qty > 1 ? `${row.qty} x ${item.name}` : item.name}
                </span>
                <span className="truncate font-mono text-[13px] leading-[18px] text-ink-secondary">{specLine(item)}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="text-[15px] font-bold tabular-nums text-ink">{usd(item.priceUsd * row.qty)}</span>
                <StatusMark status={compat.status} />
              </span>
              {canSwap && <ChevronDown aria-hidden className={cn("size-4 text-ink-secondary transition-transform", expanded && "rotate-180")} />}
            </>
          );
          const grid = cn("grid w-full items-center", canSwap ? "grid-cols-[20px_minmax(0,1fr)_auto_16px]" : "grid-cols-[20px_minmax(0,1fr)_auto]", "gap-x-3 rounded-md px-3 py-2 text-left transition-colors");
          return (
            <li key={row.kind} data-sheet-row={row.kind} data-status={compat.status} className="border-t border-border first:border-t-0">
              {canSwap ? (
                <button type="button" aria-expanded={expanded} aria-controls={listId} data-swap-toggle={row.kind} onClick={() => setOpen(expanded ? null : row.kind)} className={cn(grid, "cursor-pointer hover:bg-surface-hover", expanded && "bg-accent-soft")}>
                  {body}
                </button>
              ) : (
                <div className={grid}>{body}</div>
              )}
              {compat.status !== "fits" && (
                <p data-compat-reason className={cn("px-3 pb-2 pl-11 text-[13px] leading-[18px]", STATUS_TEXT[compat.status])}>
                  {compat.reason}
                </p>
              )}
              {canSwap && expanded && (
                <ul id={listId} aria-label={`Swap the ${row.label.toLowerCase()}`} className="mx-2 mb-2 flex flex-col gap-0.5 rounded-lg border border-border bg-bg p-1">
                  {alternativesFor(picks, row.kind, { hiddenRuleIds }).map(({ item: alt, compat: altCompat }) => {
                    const chosen = alt.id === picks[row.kind];
                    return (
                      <li key={alt.id}>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          data-swap-option={alt.id}
                          onClick={() => onSwap(row.kind, alt.id)}
                          className={cn("grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2.5 py-1.5 text-left transition-colors", chosen ? "bg-accent-soft" : "hover:bg-surface-hover")}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className={cn("truncate text-sm font-semibold", chosen ? "text-accent" : "text-ink")}>{alt.name}</span>
                            <span className="truncate font-mono text-xs text-ink-secondary">{specLine(alt)}</span>
                          </span>
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold tabular-nums text-ink">{usd(alt.priceUsd * row.qty)}</span>
                            <StatusMark status={altCompat.status} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      </>
      )}
      </div>
      <footer className="mt-2 flex flex-col gap-4 border-t border-border px-5 py-5">
        <p data-compat-summary={report.overall} className={cn("flex items-center gap-2 text-sm font-semibold", STATUS_TEXT[report.overall])}>
          <StatusMark status={report.overall} className="text-sm" />
          <span className="font-normal text-ink-secondary">
            {failed === 0 ? `· ${report.passed} of ${report.total} ${scope} pass` : `· ${failed} of ${report.total} ${scope} fail`}
          </span>
        </p>
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold text-ink">Total</p>
          <p data-sheet-total className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">
            {usd(total)}
          </p>
        </div>
        {budgetUsd !== undefined && (
          <p data-budget={total <= budgetUsd ? "within" : "over"} className={cn("-mt-2 flex items-center justify-between text-sm font-semibold", total <= budgetUsd ? "text-accent" : "text-error")}>
            <span>Budget {usd(budgetUsd)}</span>
            <span className="tabular-nums">{total <= budgetUsd ? `${usd(budgetUsd - total)} left` : `${usd(total - budgetUsd)} over`}</span>
          </p>
        )}
        <p className="-mt-2 text-xs text-ink-secondary">Example prices for invented parts.</p>
      </footer>
    </section>
  );
}
