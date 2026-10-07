"use client";

/**
 * The heat overlay: tints every part that makes heat from src/data/thermal.ts (the engine's looks, so
 * no new canvas code), fades the chassis so the parts inside show, and draws the legend. It follows
 * the light and dark themes. Loaded with a dynamic import only once the switch is on, so the heat
 * maths and the ramp are in no initial or stage chunk.
 */
import { useEffect, useMemo } from "react";
import { getItem } from "@/data/catalogue";
import type { Picks } from "@/data/compat";
import { FAN_CFM, thermalMap } from "@/data/thermal";
import { useExplodeStore, useTheme } from "@/engine/explode";
import { heatGradient, heatLooks, onlyInstalled } from "@/lib/heat-ramp";

/**
 * `installed` limits the tint to parts that are in the machine (null: every part, as on the exploded page).
 * `ownsXray` fades the chassis while the overlay is on and puts the X-ray back after; a page that sets the
 * X-ray itself (/build, per mode) passes false and fades the chassis for heat in its own effect.
 */
export default function ThermalOverlay({ picks, installed = null, ownsXray = true }: { picks: Picks; installed?: ReadonlySet<string> | null; ownsXray?: boolean }) {
  const store = useExplodeStore();
  const theme = useTheme();
  const map = useMemo(() => thermalMap(picks), [picks]);
  const fan = getItem(picks.fan);
  const size = Number(fan.spec.sizeMm);

  useEffect(() => {
    store.setLooks(heatLooks(onlyInstalled(map.heat, installed), theme));
    return () => store.setLooks(null);
  }, [store, map, theme, installed]);

  useEffect(() => {
    if (!ownsXray) return;
    const before = store.getState().xray;
    store.setXray(1);
    // Put it back only if it is still ours: a visitor who moved the X-ray slider meanwhile keeps their value.
    return () => {
      if (store.getState().xray === 1) store.setXray(before);
    };
  }, [store, ownsXray]);

  return (
    <div data-heat-legend className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[19rem] rounded-lg border border-border bg-surface/90 p-3 text-xs text-ink-secondary shadow-sm backdrop-blur">
      <p className="font-semibold text-ink">Heat, from each part&apos;s TDP and the case airflow</p>
      <div aria-hidden className="mt-2 h-2 rounded-full" style={{ background: heatGradient(theme) }} />
      <div className="mt-1 flex justify-between font-medium">
        <span>Cool</span>
        <span>Hot</span>
      </div>
      <p data-heat-note className="mt-2">
        Assumed airflow {Math.round(map.airflowCfm)} CFM: two {size} mm fans at {FAN_CFM[size] ?? 0} CFM each, one in and one out. Invented numbers.
      </p>
      {map.throttling && <p className="mt-1 font-semibold text-caution">This cooler is rated below the CPU: it will throttle.</p>}
    </div>
  );
}
