"use client";

/**
 * The /build game's DOM: the title row with the mode picker, the stage with the parts tray beside it
 * (a rail on a wide screen, a strip under the stage on a phone, so picking and placing never means
 * scrolling), the step bar under both, and on the right the mode card and the spec sheet (a bottom
 * sheet on a phone). The 3D stage is lazy and optional: every action here works with no canvas.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Check, CircleAlert, Droplet, Eye, Lightbulb, Link2, Power, RefreshCw, Repeat, RotateCcw, SkipForward, Star, Timer, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PART_ICON } from "@/components/part-icons";
import { feedback, renderBootScreen } from "@/data/assembly";
import type { CatalogueKind } from "@/data/catalogue";
import { briefs, faults, modes, tiers, type ModeId, type TierId } from "@/data/modes";
import { compatReport, type Picks } from "@/data/compat";
import { pcSidecar } from "@/data/pc";
import { defaultPickIds, picksTotal } from "@/data/showcase";
import { StageGate, useExplodeState, useExplodeStore, useMuted, useTheme } from "@/engine/explode";
import "@/models/register";
import { Poster } from "../stage-client";
import { StageOverlays } from "../stage-overlays";
import { playPostBeep, playReject, playSnap, sound } from "@/game/audio";
import { bestKey, bestSnapshot, parseBest, subscribeBest, writeBest } from "@/game/best";
import { useMediaQuery } from "@/hooks/use-media-query";
import { TRAY_ORDER } from "@/game/layout";
import { modeView } from "@/game/mode-view";
import { parSeconds as parFor, pendingStepFor, refusalOf, scoreGame, selectable, trayParts } from "@/game/machine";
import { installedParts } from "@/game/installed";
import { useStageFx } from "@/lib/stage-fx";
import { createGameStore, useGame } from "@/game/store";
import { withSharedPicks } from "@/lib/share-build";
import { cn } from "@/lib/utils";
import { ModeCard, ModeDetails, ModePicker } from "./mode-panel";
import { MobileSheet } from "./mobile-sheet";
import { SpecSheet } from "./spec-sheet";

const BuildStage = dynamic(() => Promise.all([import("./build-stage"), import("three")]).then(([m]) => m), { ssr: false });

const BOOT_VARS = { cpu: "8-core desktop CPU", cores: 8, ramGb: 32768, gpu: "12 GB graphics card", nvme: "1 TB NVMe", cpuTemp: 38, gpuTemp: 34, fps: 144 };
const BOOT_LINE_MS = 220;
const label = (id: string) => pcSidecar.parts[id]?.label ?? id;

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Scrolls a list (only the list) just far enough to show one of its items. */
function revealIn(list: HTMLElement, item: HTMLElement) {
  const l = list.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  if (i.top < l.top) list.scrollTop -= l.top - i.top;
  else if (i.bottom > l.bottom) list.scrollTop += i.bottom - l.bottom;
  if (i.left < l.left) list.scrollLeft -= l.left - i.left;
  else if (i.right > l.right) list.scrollLeft += i.right - l.right;
}

const PANEL = "rounded-xl border border-border bg-surface";
const EYEBROW = "text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary";
// On a phone a stat is one line (label, value), so the row of them takes 32px, not 54.
const STAT = "rounded-lg border border-border px-3 py-1.5 max-md:flex max-md:items-baseline max-md:gap-1.5 max-md:py-1";
const STAT_LABEL = "text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary";
const STAT_VALUE = "text-base font-bold text-ink tabular-nums";

/** How much of the case the X-ray fades in Won't boot: 1 is a 6% ghost. On the dark ground that ghost vanishes, so it keeps a third of its body there. */
const XRAY_LIGHT = 1;
const XRAY_DARK = 0.7;

/** `header` is the page's server-rendered heading; `initialPicks`, `initialMode` and `initialShared` come from the address. */
export function BuildGame({ header, initialPicks = defaultPickIds, initialMode = "guided", initialShared = false }: { header: ReactNode; initialPicks?: Picks; initialMode?: ModeId; initialShared?: boolean }) {
  const [game] = useState(() => createGameStore({ mode: initialMode, picks: initialPicks }));
  const s = useGame(game);
  const explode = useExplodeStore();
  const { ready } = useExplodeState(explode);
  // Off until the visitor turns it on, and remembered: the engine's switch, shared with the exploded page.
  const muted = useMuted(sound());
  const [now, setNow] = useState(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const desktop = useMediaQuery("(min-width: 1024px)");
  // Read after hydration (the server snapshot is null), and again whenever a best is saved.
  const best = parseBest(useSyncExternalStore(subscribeBest, bestSnapshot, () => null));
  // The sheet's picks. They are the player's shopping (Free and Brief) and never reach the 3D model.
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [briefId, setBriefId] = useState(briefs[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The address carried a build: say so until the visitor leaves it (a reset or another mode).
  const [shared, setShared] = useState(initialShared);
  const theme = useTheme();
  const { heat } = useStageFx();
  const trayList = useRef<HTMLUListElement>(null);

  const view = modeView(s.mode, s.tier);
  const brief = briefs.find((b) => b.id === briefId) ?? briefs[0];
  const hiddenRuleIds = tiers[s.tier].hiddenRuleIds;
  const report = useMemo(() => compatReport(picks, { hiddenRuleIds }), [picks, hiddenRuleIds]);
  const tray = useMemo(() => new Set(trayParts(s)), [s]);
  // The heat overlay tints only what is in the machine: a loose part keeps its own look.
  const installed = useMemo(() => installedParts(s), [s]);
  const active = s.steps.find((x) => x.id === s.activeStep);
  const pendingSub = active?.subSteps?.find((x) => !s.subDone.has(x.id));
  const selectedStep = s.selectedPart ? pendingStepFor(s, s.selectedPart) : undefined;
  const powerStep = s.steps.find((x) => x.kind === "action");
  const powerReady = !!powerStep && powerStep.after.every((id) => s.placed.has(id));
  const score = scoreGame(s);
  const elapsed = s.startedAt === null ? 0 : (s.finishedAt ?? now) - s.startedAt;
  const boot = useMemo(() => renderBootScreen(BOOT_VARS), []);
  const bootLines = s.finishedAt === null ? 0 : reducedMotion ? boot.length : Math.min(boot.length, Math.max(0, Math.floor((now - s.finishedAt) / BOOT_LINE_MS) + 1));
  const runSeconds = s.finishedAt !== null && s.startedAt !== null ? Math.round((s.finishedAt - s.startedAt) / 1000) : 0;
  const faultTotal = s.faults.length + s.fixed.length;
  const wontBoot = s.mode === "wontBoot";

  // The canvas shows the game's selection with the engine's outline.
  useEffect(() => explode.select(s.selectedPart), [explode, s.selectedPart]);

  // The rules in Free read the sheet's parts.
  useEffect(() => game.setPicks(picks), [game, picks]);

  // The address carries the build, so a refresh or a copied link restores it. replaceState, not a
  // navigation: no new history entry, no new request, and every other parameter and the hash stay.
  useEffect(() => {
    const search = withSharedPicks(window.location.search, picks);
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [picks]);

  // The one owner of the X-ray here (the heat overlay is told not to set its own): heat fades the chassis
  // fully, and Won't boot opens the case so the parts inside can be picked and inspected. Turning heat
  // off lands on the current mode's value, however the mode changed while it was on.
  useEffect(() => {
    explode.setXray(heat ? 1 : wontBoot ? (theme === "dark" ? XRAY_DARK : XRAY_LIGHT) : 0);
  }, [explode, heat, wontBoot, theme]);

  // The part that is next, or picked, stays in view in the tray, without moving the page.
  const focusPart = wontBoot ? s.selectedPart : (active?.partId ?? null);
  useEffect(() => {
    const list = trayList.current;
    const item = focusPart ? list?.querySelector<HTMLElement>(`[data-tray-part="${focusPart}"]`) : null;
    if (list && item) revealIn(list, item);
  }, [focusPart]);

  const changeMode = useCallback(
    (mode: ModeId) => {
      game.setMode(mode);
      setPicks(defaultPickIds);
      setShared(false);
    },
    [game],
  );
  const swap = useCallback((kind: CatalogueKind, id: string) => setPicks((p) => ({ ...p, [kind]: id })), []);

  // A part picked in 3D: a tray part is picked up (any part, in Won't boot); anything else (the case, a
  // fitted part) places the held part on Easy, where anywhere on the case counts.
  const onPick = useCallback(
    (id: string | null) => {
      const st = game.getState();
      if (id === null) game.select(null);
      else if (selectable(st, id)) game.select(id);
      else if (st.selectedPart && st.mode !== "wontBoot") {
        if (tiers[st.tier].highlights === "all-valid") game.placeSelected();
        else game.say(tiers[st.tier].highlights === "none" ? "Click the outline where that part goes." : "Click the glowing outline where that part goes.");
      }
      explode.select(game.getState().selectedPart);
    },
    [game, explode],
  );

  // Sound and haptics follow the store's events, whichever path (list, click, drag) caused them.
  useEffect(() => {
    let seq = game.getState().last?.seq ?? 0;
    return game.subscribe(() => {
      const last = game.getState().last;
      if (!last || last.seq === seq) return;
      seq = last.seq;
      if (last.kind === "placed" || last.kind === "fixed") {
        playSnap();
        // The mute switch has always silenced the haptic tick too.
        if (typeof navigator.vibrate === "function" && !sound().isMuted()) navigator.vibrate(feedback.snap.hapticMs);
      } else if (last.kind === "rejected" || last.kind === "noboot") playReject();
      else if (last.kind === "powered") playPostBeep();
    });
  }, [game]);

  // The clock ticks while a build runs, and after power on until the boot screen has played out.
  useEffect(() => {
    if (s.startedAt === null) return;
    const until = s.finishedAt === null ? Infinity : s.finishedAt + (boot.length + 1) * BOOT_LINE_MS;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t > until) window.clearInterval(id);
    }, s.finishedAt === null ? 250 : BOOT_LINE_MS / 2);
    return () => window.clearInterval(id);
  }, [s.startedAt, s.finishedAt, boot.length]);

  // On finishing: save the score as the mode and tier's best if it beats it (a mode that is not scored saves nothing).
  useEffect(() => {
    if (s.finishedAt === null) return;
    const sc = scoreGame(game.getState());
    if (sc) writeBest(bestKey(s.mode, s.tier), { stars: sc.stars, seconds: runSeconds });
  }, [s.finishedAt, s.mode, s.tier, runSeconds, game]);

  const tierBest = best[bestKey(s.mode, s.tier)];
  const thisRunIsBest = !!score && !!tierBest && tierBest.stars === score.stars && tierBest.seconds === runSeconds;
  const card = <ModeCard mode={s.mode} tier={s.tier} onTier={(t: TierId) => game.setTier(t)} />;
  const details = <ModeDetails mode={s.mode} tier={s.tier} picks={picks} brief={brief} onBrief={setBriefId} active={s.faults} fixed={s.fixed} steps={s.steps} placed={s.placed} />;
  const sheet = (className?: string) => (
    <SpecSheet picks={picks} onSwap={swap} canSwap={view.canSwap} hiddenRuleIds={hiddenRuleIds} budgetUsd={view.showBudget ? brief.budgetUsd : undefined} className={className} />
  );

  const defaultMessage = wontBoot
    ? "Read the symptoms, then pick a suspect part in the tray or in the view."
    : s.mode === "free"
      ? "Pick any part from the tray and place it."
      : "Pick the first part from the tray. The glowing outline shows where it goes.";
  const eyebrow =
    s.mode === "free"
      ? `Free build · ${s.placed.size} of ${s.steps.length} steps`
      : wontBoot
        ? `Won't boot · ${s.fixed.length} of ${faultTotal} faults fixed`
        : `${modes[s.mode].label} · ${active ? `step ${s.steps.indexOf(active) + 1} of ${s.steps.length}` : "done"}`;
  // A refusal is shown on its own line; the instruction stays under it, so a wrong move never takes the step away.
  const refusal = refusalOf(s);
  const instruction = refusal ? (wontBoot || s.mode === "free" ? defaultMessage : (pendingSub?.hint ?? active?.hint ?? defaultMessage)) : (s.message ?? defaultMessage);
  const title = wontBoot ? (s.selectedPart ? label(s.selectedPart) : "Find what is stopping it") : s.mode === "free" ? "Build it in any order that works" : pendingSub ? pendingSub.label : (active?.label ?? "");

  return (
    <div data-build-game data-placed-count={s.placed.size} data-tier={s.tier} data-mode={s.mode} className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
      {/* Below lg the column is ordered for a phone (the step sits above the tray, so its prompt shows without scrolling); the DOM stays in the order a keyboard wants. */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 max-lg:order-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6">
          {header}
          <ModePicker mode={s.mode} onChange={changeMode} />
        </div>

        {shared && (
          <div data-shared-note className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-secondary max-lg:order-2 sm:flex-row sm:items-center sm:gap-3">
            <p className="flex min-w-0 flex-1 items-start gap-2">
              <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              Opened from a shared build, in Free build so its parts can be swapped.
            </p>
            <Button variant="outline" size="sm" className="min-h-9 self-start" data-shared-reset onClick={() => changeMode("guided")}>
              <RotateCcw /> Back to the shipped build
            </Button>
          </div>
        )}

        <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-4">
          <div data-stage-ready={ready ? "true" : "false"} className="relative max-lg:order-3">
            <StageGate
              className="stage-backdrop h-[280px] max-h-none min-h-0 border-0 md:h-[clamp(340px,calc(100dvh_-_330px),640px)]"
              poster={
                <Poster
                  label="The build scene: an open PC case in the middle, the parts standing on a tray in front of it"
                  title={wontBoot ? "Won't boot" : "Build the PC"}
                  detail={wontBoot ? "The case opens so you can inspect each part." : "Fit each part where it goes, from the power supply to the first boot."}
                />
              }
            >
              {(gate) => <BuildStage game={game} onPick={onPick} wontBoot={wontBoot} {...gate} />}
            </StageGate>
            <StageOverlays picks={picks} installed={installed} ownsXray={false} />
          </div>

          <nav aria-label={wontBoot ? "Suspect parts" : "Parts tray"} className="max-lg:order-6 lg:relative">
            <div className="lg:absolute lg:inset-0 lg:flex lg:flex-col">
              <div className="mb-2 flex items-center justify-between gap-2 lg:shrink-0">
                <h2 className={EYEBROW}>{wontBoot ? "Suspect parts" : "Parts tray"}</h2>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-9" aria-pressed={muted} aria-label={muted ? "Sound off" : "Sound on"} data-mute onClick={() => sound().setMuted(!muted)}>
                    {muted ? <VolumeX /> : <Volume2 />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9" aria-label={wontBoot ? "Deal a new machine" : "Reset the build"} data-reset onClick={() => game.reset()}>
                    <RotateCcw />
                  </Button>
                </div>
              </div>
              <ul
                ref={trayList}
                data-tray
                aria-label={wontBoot ? "Parts to inspect" : "Parts to fit"}
                // Two rows on a phone, scrolling sideways. The padding and matching negative margin keep a tile's focus ring (2px plus its 2px offset) inside the scroller.
                className="-mx-4 -my-1 grid auto-cols-[8.75rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-4 py-1 lg:-mx-1 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-2 lg:grid-rows-none lg:content-start lg:overflow-x-hidden lg:overflow-y-auto lg:min-h-0 lg:flex-1 lg:px-1 lg:pr-2"
              >
                {TRAY_ORDER.map((id) => {
                  const fixedHere = s.fixed.some((f) => faults[f].fixPartId === id);
                  const available = wontBoot ? s.finishedAt === null : tray.has(id);
                  const on = s.selectedPart === id;
                  const next = pendingStepFor(s, id);
                  const Icon = PART_ICON[id];
                  const placed = !wontBoot && !next;
                  const done = placed || fixedHere;
                  const status = wontBoot
                    ? fixedHere
                      ? "Fixed"
                      : null
                    : !next
                      ? null
                      : next.movesExisting
                        ? available
                          ? "Move it into the case"
                          : "On the bench"
                        : active?.partId === id
                          ? s.mode === "free"
                            ? "Suggested"
                            : "Next"
                          : null;
                  return (
                    <li key={id} className="flex">
                      <button
                        type="button"
                        data-tray-part={id}
                        aria-pressed={on}
                        disabled={!available || s.finishedAt !== null}
                        onClick={() => game.select(on ? null : id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-default",
                          on ? "border-accent bg-accent-soft" : available ? "border-border bg-surface hover:bg-surface-hover" : "border-border bg-transparent",
                        )}
                      >
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", on ? "bg-accent text-ink-inverted" : done ? "bg-accent-soft text-accent" : "bg-surface-hover text-ink")}>
                          {done ? <Check aria-hidden className="size-4" strokeWidth={2} /> : Icon && <Icon aria-hidden className="size-4" strokeWidth={1.5} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("line-clamp-2 text-xs leading-4 font-semibold", available && !placed ? "text-ink" : "text-ink-secondary")}>{label(id)}</span>
                          {status && <span className={cn("block text-xs leading-4 font-semibold", status === "Next" || status === "Suggested" || status === "Fixed" ? "text-accent" : "text-ink-secondary")}>{status}</span>}
                          {placed && <span className="sr-only">In place</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>

        {s.finishedAt !== null ? (
          <section data-end-card aria-label="Result" className={cn(PANEL, "border-accent/50 p-5 max-lg:order-4")}>
            <h2 className="text-xl font-bold text-ink">It boots.</h2>
            {score ? (
              <>
                <p className="mt-1 flex gap-1" aria-label={`${score.stars} of 3 stars`}>
                  {[0, 1, 2].map((i) => (
                    <Star key={i} aria-hidden className={cn("size-6", i < score.stars ? "fill-accent text-accent" : "text-ink-tertiary")} />
                  ))}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-ink-secondary">
                  {score.breakdown.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-secondary">{modes[s.mode].label} is not scored: no stars and no best time.</p>
            )}
            <p className="mt-3 text-sm text-ink-secondary">{feedback.postBeep.description}</p>
            <p data-best className="mt-3 text-sm text-ink">
              {!score
                ? ""
                : thisRunIsBest
                  ? `Your best on ${tiers[s.tier].label}: this run.`
                  : tierBest
                    ? `Your best on ${tiers[s.tier].label}: ${tierBest.stars} stars in ${clock(tierBest.seconds * 1000)}.`
                    : ""}
            </p>
            <Button className="mt-4" onClick={() => game.reset()}>
              <RotateCcw /> {wontBoot ? "Another machine" : "Build it again"}
            </Button>
          </section>
        ) : (
          <section aria-label={wontBoot ? "Diagnosis" : "Current step"} data-step-bar className={cn(PANEL, "flex flex-col gap-1.5 p-3 max-lg:order-4 md:gap-3 md:p-4 md:flex-row md:items-center md:justify-between")}>
            {/* On a phone the wrappers dissolve and the card reads: heading, actions, stats, then the message, so a long refusal grows the card downward and never pushes the actions under the fixed "This build" bar. */}
            <div className="max-md:contents md:min-w-0 md:flex-1">
              <div className="min-w-0">
                <p className={EYEBROW}>{eyebrow}</p>
                <h2 data-step-label className="mt-0.5 truncate text-lg leading-6 font-bold text-ink md:leading-7">
                  {title}
                </h2>
              </div>
              <div data-game-message aria-live="polite" role="status" className="flex flex-col gap-1 max-md:order-4 md:mt-0.5">
                {refusal && (
                  <p data-refusal className="flex items-start gap-2 text-sm leading-5 font-semibold text-error max-md:text-[13px] max-md:leading-[18px]">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {refusal}
                  </p>
                )}
                <p className={cn("min-h-10 text-sm leading-5 text-ink-secondary", !refusal && "line-clamp-2")}>{instruction}</p>
              </div>
            </div>
            <div className="max-md:contents md:flex md:flex-col md:gap-2 md:items-end">
              <div className="flex flex-wrap gap-2 max-md:order-2 max-md:gap-1.5">
                {wontBoot ? (
                  <>
                    <Button variant="outline" size="sm" data-inspect disabled={!s.selectedPart} onClick={() => game.inspect()}>
                      <Eye /> Inspect
                    </Button>
                    <Button variant="outline" size="sm" data-reseat disabled={!s.selectedPart} onClick={() => game.fix("reseat")}>
                      <RefreshCw /> Reseat
                    </Button>
                    <Button variant="outline" size="sm" data-swap-part disabled={!s.selectedPart} onClick={() => game.fix("swap")}>
                      <Repeat /> Swap
                    </Button>
                    <Button variant="outline" size="sm" data-hint onClick={() => game.hint()}>
                      <Lightbulb /> Hint
                    </Button>
                    <Button data-power size="sm" onClick={() => game.powerOn()}>
                      <Power /> Power on
                    </Button>
                  </>
                ) : (
                  <>
                    {s.selectedPart && selectedStep && (
                      <Button data-place size="sm" onClick={() => game.placeSelected()}>
                        Place {label(s.selectedPart)}
                      </Button>
                    )}
                    {pendingSub && (
                      <Button data-substep={pendingSub.id} size="sm" variant="secondary" onClick={() => game.applySubStep(pendingSub.id)}>
                        <Droplet /> {pendingSub.label}
                      </Button>
                    )}
                    {(s.mode === "free" ? powerReady : s.activeStep === "power_on") && (
                      <Button data-power size="sm" onClick={() => game.powerOn()}>
                        <Power /> Power on
                      </Button>
                    )}
                    <Button variant="outline" size="sm" data-hint onClick={() => game.hint()}>
                      <Lightbulb /> Hint
                    </Button>
                    <Button variant="outline" size="sm" data-next-step disabled={!active || active.kind !== "place"} onClick={() => game.nextStep()}>
                      <SkipForward /> Next step
                    </Button>
                  </>
                )}
              </div>
              <dl className="flex gap-2 text-sm max-md:order-3">
                {view.showTimer && (
                  <div className={STAT}>
                    <dt className={cn(STAT_LABEL, "flex items-center gap-1")}>
                      <Timer aria-hidden className="size-3" /> Time
                    </dt>
                    <dd data-game-clock className={STAT_VALUE}>
                      {clock(elapsed)}
                      {view.parSeconds !== null && <span className="ml-1 text-xs font-medium text-ink-secondary">par {clock(parFor(s.tier, s.mode) * 1000)}</span>}
                    </dd>
                  </div>
                )}
                <div className={STAT}>
                  <dt className={STAT_LABEL}>Mistakes</dt>
                  <dd data-game-mistakes className={STAT_VALUE}>
                    {s.mistakes}
                  </dd>
                </div>
                {/* The bar's eyebrow already says the step (or the faults) on a phone. */}
                <div className={cn(STAT, "max-md:hidden")}>
                  <dt className={STAT_LABEL}>{wontBoot ? "Faults" : "Steps"}</dt>
                  <dd className={STAT_VALUE}>{wontBoot ? `${s.fixed.length} / ${faultTotal}` : `${s.placed.size} / ${s.steps.length}`}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {s.finishedAt !== null && (
          <section data-boot-screen aria-label="Boot screen" className="rounded-xl border border-border bg-black p-4 font-mono text-xs leading-relaxed text-[#8ef0a6] max-lg:order-5">
            {boot.slice(0, bootLines).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        )}

        {/* On a phone the mode card comes after the tray; on a wide screen it is in the right column. */}
        <div className="max-lg:order-7 lg:hidden">{card}</div>
        {/* What is specific to the mode fills the space under the step card, so the right column stays the card and the sheet; on a wide screen it grows to the foot of the column so the two columns end together. */}
        <div className="max-lg:order-8 lg:flex lg:flex-1 lg:flex-col">{details}</div>
      </div>

      {/* The column runs the height of the stage column, so the sheet can stick inside it while the mode card scrolls away. */}
      <aside className="hidden flex-col gap-6 lg:flex lg:self-stretch">
        {card}
        <div className="sticky top-6">{sheet()}</div>
      </aside>

      {/* The phone's dialog (open only below the wide layout) closes itself when the window widens. */}
      <MobileSheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen} total={picksTotal(picks)} status={report.overall}>
        {sheet("rounded-none border-0 [&>header]:pt-0")}
      </MobileSheet>
    </div>
  );
}
