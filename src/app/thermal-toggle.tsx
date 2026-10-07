"use client";

import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stageFx, useStageFx } from "@/lib/stage-fx";
import { cn } from "@/lib/utils";

/** The heat overlay's switch. Only the switch is here: the overlay itself loads when it is turned on (thermal-overlay.tsx). */
export function HeatToggle({ className }: { className?: string }) {
  const { heat } = useStageFx();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={heat}
      data-heat-toggle
      onClick={() => stageFx.setHeat(!heat)}
      className={cn("bg-surface/90 backdrop-blur", heat && "border-accent text-accent", className)}
    >
      <Flame aria-hidden />
      Heat
    </Button>
  );
}
