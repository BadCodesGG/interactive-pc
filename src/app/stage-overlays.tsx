"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Picks } from "@/data/compat";
import { playPostBeep } from "@/game/audio";
import { stageFx, useStageFx } from "@/lib/stage-fx";
import { cn } from "@/lib/utils";
import { HeatToggle } from "./thermal-toggle";

// Each loads on first use, in a chunk of its own: neither is in the initial JS or in the stage's.
const ThermalOverlay = dynamic(() => import("./thermal-overlay"), { ssr: false });
const PowerBoot = dynamic(() => import("./power-boot"), { ssr: false });

/**
 * What sits over a stage: the Heat switch (and Power on, where the page offers it) at the top right,
 * the boot screen at the top left while the machine is on, the heat legend at the bottom left while the
 * overlay is on (tinting only `installed` parts, when given). Place it inside the stage's `relative` wrapper.
 * `ownsXray` is false on a page that sets the X-ray itself (see ThermalOverlay).
 */
export function StageOverlays({ picks, power = false, installed = null, ownsXray = true }: { picks: Picks; power?: boolean; installed?: ReadonlySet<string> | null; ownsXray?: boolean }) {
  const { heat, power: on } = useStageFx();
  // The switches belong to the page: leaving it puts them back.
  useEffect(() => () => stageFx.reset(), []);
  return (
    <>
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {power && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={on}
            data-power-toggle
            onClick={() => {
              stageFx.setPower(!on);
              if (!on) playPostBeep();
            }}
            className={cn("bg-surface/90 backdrop-blur", on && "border-accent text-accent")}
          >
            <Power aria-hidden />
            {on ? "Power off" : "Power on"}
          </Button>
        )}
        <HeatToggle />
      </div>
      {power && on && <PowerBoot />}
      {heat && <ThermalOverlay picks={picks} installed={installed} ownsXray={ownsXray} />}
    </>
  );
}
