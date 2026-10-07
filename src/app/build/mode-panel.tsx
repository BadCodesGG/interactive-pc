"use client";

import { Check, ClipboardList, Circle, Shapes, Stethoscope, Timer, Wallet, X, Zap, type LucideIcon } from "lucide-react";
import type { AssemblyStep } from "@/data/assembly";
import { getItem, type CatalogueItem, type CatalogueKind } from "@/data/catalogue";
import type { Picks } from "@/data/compat";
import { briefs, evaluateBrief, faults, modes, tiers, type Brief, type ModeId, type TierId } from "@/data/modes";
import { usd } from "@/data/showcase";
import { BUILD_MODES, faultClues, modeView, tierBlurb } from "@/game/mode-view";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<ModeId, LucideIcon> = { guided: ClipboardList, free: Shapes, brief: Wallet, wontBoot: Stethoscope, speedrun: Zap };

/** What a mode does today, for the parts of it that are not the whole of what its data describes. */
const MODE_NOTE: Partial<Record<ModeId, string>> = {
  guided: "Each part goes in after the ones it rests on. The steps run in this order; the current one is in the step bar.",
  speedrun: "The same steps, against the clock. A wrong move costs time, so read the order before you start.",
  free: "A part is refused only when something physical is in the way: the board before the CPU, the CPU before the cooler, the panels last. Swap parts on the sheet and read what it does to the checks.",
  brief: "Shop on the sheet against the brief, then build. The budget and the requirements are checked live.",
  wontBoot: "Read the symptoms, pick a suspect part in the tray or the view and inspect it, then reseat it or swap it. Fix every fault and press power. Pressing power on a faulty machine shows the symptoms and costs nothing.",
};

/** What the card says about a mode, where the data's blurb describes more than the page offers. */
const MODE_BLURB: Partial<Record<ModeId, string>> = {
  free: "A sandbox: you choose the parts and the order, and nothing is scored.",
};

/** Short labels for the picker, so five fit on a phone. */
const SHORT: Record<ModeId, string> = { guided: "Guided", free: "Free", brief: "Brief", wontBoot: "Won't boot", speedrun: "Speedrun" };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Five modes as a segmented control. On a phone it is one row that scrolls sideways, so no chip is left alone on a second row. */
export function ModePicker({ mode, onChange }: { mode: ModeId; onChange: (mode: ModeId) => void }) {
  return (
    // The vertical padding and the matching negative margin keep the focus ring of a chip inside the scroller.
    <div role="radiogroup" aria-label="Game mode" data-mode-picker className="-mx-4 -my-1 flex gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {BUILD_MODES.map((id) => {
        const Icon = MODE_ICON[id];
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            data-mode-option={id}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors sm:min-h-11 sm:gap-2 sm:px-4",
              on ? "border-accent bg-accent text-ink-inverted" : "border-border bg-surface text-ink-secondary hover:bg-surface-hover hover:text-ink",
            )}
          >
            <Icon aria-hidden className="hidden size-4 sm:block" strokeWidth={1.75} />
            {SHORT[id]}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-ink-secondary">{children}</span>;
}

/** The brief's parts as the catalogue items the requirement check reads. */
function briefItems(picks: Picks): Partial<Record<CatalogueKind, CatalogueItem>> {
  return Object.fromEntries((Object.keys(picks) as CatalogueKind[]).map((k) => [k, getItem(picks[k])]));
}

export interface ModeCardProps {
  mode: ModeId;
  tier: TierId;
  onTier: (tier: TierId) => void;
  picks: Picks;
  brief: Brief;
  onBrief: (id: string) => void;
  /** Won't boot: the faults still in the machine and the ones fixed, by id. */
  active: readonly string[];
  fixed: readonly string[];
  /** Guided and Speedrun: the build's steps in order, and the ids of those done. */
  steps: readonly AssemblyStep[];
  placed: ReadonlySet<string>;
}

/** The selected mode's rules in a line, and the difficulty. What is specific to the mode (the brief, the symptoms) is in `ModeDetails`. */
export function ModeCard({ mode, tier, onTier }: Pick<ModeCardProps, "mode" | "tier" | "onTier">) {
  const view = modeView(mode, tier);
  const def = modes[mode];

  return (
    // A fixed minimum height on a wide screen, so the spec sheet under the card starts in the same place in every mode.
    <section data-mode-card={mode} aria-label={`${def.label} mode`} className="rounded-xl border border-border bg-surface p-5 lg:min-h-[20rem]">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">{def.label}</p>
      <p className="mt-1 text-[15px] leading-[22px] text-ink">{MODE_BLURB[mode] ?? def.blurb}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {view.showTimer && view.parSeconds !== null && (
          <Chip>
            <Timer aria-hidden className="size-3" /> Par {clock(view.parSeconds)}
          </Chip>
        )}
        {view.scored ? <Chip>Earns stars</Chip> : <Chip>Not scored</Chip>}
        {view.showBudget && <Chip>Budget</Chip>}
        {view.canSwap ? <Chip>You pick the parts</Chip> : <Chip>Fixed parts</Chip>}
        {def.rules === "all" && <Chip>All rules live</Chip>}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <div role="radiogroup" aria-label="Difficulty" className="inline-flex self-start rounded-lg border border-border p-0.5">
          {view.tiers.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={view.tier.id === t}
              data-tier-option={t}
              onClick={() => onTier(t)}
              className={cn("min-h-9 cursor-pointer rounded-md px-3.5 text-sm font-semibold transition-colors", view.tier.id === t ? "bg-accent text-ink-inverted" : "text-ink-secondary hover:bg-surface-hover hover:text-ink")}
            >
              {tiers[t].label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-secondary">{tierBlurb(mode, view.tier.id)}</p>
      </div>
    </section>
  );
}

/** The steps, ticked off as they are done. Numbered where the order is the rule; Free takes any order that works, so there it is a plain checklist. */
function StepChecklist({ ordered, steps, placed }: { ordered: boolean; steps: ModeCardProps["steps"]; placed: ModeCardProps["placed"] }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List data-build-order aria-label={ordered ? "Steps" : "Parts to place"} className="gap-x-6 text-sm sm:columns-2">
      {steps.map((step, i) => {
        const done = placed.has(step.id);
        return (
          <li key={step.id} data-build-order-step={step.id} data-done={done} className={cn("flex break-inside-avoid items-start gap-2 py-[3px]", done ? "text-ink" : "text-ink-secondary")}>
            {done ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" /> : <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-tertiary" />}
            {ordered && <span className="tabular-nums text-ink-tertiary">{i + 1}.</span>}
            <span className="min-w-0 break-words">{step.label}</span>
            {done && <span className="sr-only">Done</span>}
          </li>
        );
      })}
    </List>
  );
}

/**
 * What is specific to the mode: how Free refuses a part, the brief to shop for, the symptoms to diagnose, and
 * (Guided, Speedrun, Free) the steps, ticked off as they are done. On a wide screen the block grows to the bottom of
 * the stage column, so that column ends level with the spec sheet beside it instead of far above it.
 */
export function ModeDetails({ mode, tier, picks, brief, onBrief, active, fixed, steps, placed }: Omit<ModeCardProps, "onTier">) {
  const view = modeView(mode, tier);
  const result = mode === "brief" ? evaluateBrief(brief, briefItems(picks)) : null;
  const heading = mode === "free" ? "How Free build works" : mode === "brief" ? "The brief" : mode === "wontBoot" ? "What the owner reports" : "The build order";

  return (
    <section data-mode-details={mode} aria-label={heading} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 lg:flex-1">
      <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">{heading}</h2>
      {MODE_NOTE[mode] && <p className="text-sm text-ink-secondary">{MODE_NOTE[mode]}</p>}

      {(mode === "guided" || mode === "speedrun" || mode === "free") && <StepChecklist ordered={mode !== "free"} steps={steps} placed={placed} />}

      {result && (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Brief" className="flex flex-col gap-1">
            {briefs.map((b) => {
              const on = b.id === brief.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-brief-option={b.id}
                  onClick={() => onBrief(b.id)}
                  className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 text-left text-sm transition-colors", on ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-secondary hover:bg-surface-hover hover:text-ink")}
                >
                  <span className="font-semibold">{b.title}</span>
                  <span className="tabular-nums">{usd(b.budgetUsd)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-ink-secondary">{brief.blurb}</p>
          <ul data-brief-requirements aria-label="Requirements" className="flex flex-col gap-1.5 text-sm">
            {result.failures.length === 0 ? (
              <li className="flex items-center gap-2 font-semibold text-accent">
                <Check aria-hidden className="size-4" /> Every requirement is met.
              </li>
            ) : (
              result.failures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-error">
                  <X aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {f}
                </li>
              ))
            )}
            <li data-brief-budget={result.withinBudget ? "within" : "over"} className={cn("flex items-start gap-2 font-semibold", result.withinBudget ? "text-accent" : "text-error")}>
              {result.withinBudget ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" /> : <X aria-hidden className="mt-0.5 size-4 shrink-0" />}
              {result.withinBudget ? `Within the ${usd(brief.budgetUsd)} budget.` : `${usd(result.spentUsd - brief.budgetUsd)} over the ${usd(brief.budgetUsd)} budget.`}
            </li>
          </ul>
        </div>
      )}

      {mode === "wontBoot" && (
        <ul data-fault-list className="flex flex-col gap-3">
          {active.map((id) => (
            <li key={id} data-fault-active={id} className="flex flex-col gap-1 border-l-2 border-error pl-3 text-sm text-ink-secondary">
              {faultClues(faults[id], view.tier.id).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </li>
          ))}
          {fixed.map((id) => (
            <li key={id} data-fault-fixed={id} className="flex items-start gap-2 border-l-2 border-accent pl-3 text-sm text-accent">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">{faults[id].label}: fixed.</span> <span className="text-ink-secondary">{faults[id].fix}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
