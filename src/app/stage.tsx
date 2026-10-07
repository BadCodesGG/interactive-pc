"use client";

import { Suspense, lazy, useState } from "react";
import { useExplodeStore, type ArOptions, type GateRenderProps, type Frame, type RenderProp, type Sidecar, type StagePalette, type Themed } from "@/engine/explode";
import ExplodeStage from "@/engine/explode/stage";
import { useStageFx } from "@/lib/stage-fx";
import { pcFinish } from "@/models/pc/finish";

// Power on: the fan and lighting layer is its own chunk, mounted on the first press.
const PowerScene = lazy(() => import("./power-scene"));

export interface StageProps {
  sidecar: Sidecar;
  /** First camera angle, [azimuth, polar] in radians. */
  initialAngles?: [number, number];
  /** Adds a shadowless fill light from this point, for a model whose best side faces away from the key light. */
  fillFrom?: [number, number, number];
  /** Fill light strength. */
  fillIntensity?: number;
  palette?: Themed<Partial<StagePalette>>;
  /** First framing as a fraction of the fitted pose's bounding sphere. */
  frame?: Frame;
  /** "union" fits both poses once and never refits; the default follows the slider. */
  fit?: "pose" | "union";
  background?: Themed<string>;
  accent?: Themed<string>;
  /** Realism options (see the engine's render.ts), one set or one per theme. */
  render?: RenderProp;
  /** Surface finishes for a procedural model. A function cannot cross from a server page, so it is named. */
  finish?: "pc";
  /** The first-load camera fly-in. */
  opening?: boolean;
  /** View in AR: the model's real-world size. */
  ar?: ArOptions;
  /** Offer Power on (the fans and lighting layer loads on the first press). */
  power?: boolean;
}

/** The lazy chunk's entry: the canvas, bound to the page's store. Loaded only by stage-client.tsx. */
export default function Stage({ sidecar, initialAngles, fillFrom, fillIntensity = 1.7, palette, frame, fit, background, accent, render, finish, opening, ar, power, active, mobile, reduced, onReady, onFail }: GateRenderProps & StageProps) {
  const store = useExplodeStore();
  const { power: on } = useStageFx();
  // Armed by the first press and kept, so the fans can run down after Power off.
  const [armed, setArmed] = useState(false);
  if (power && on && !armed) setArmed(true);
  return (
    <ExplodeStage
      sidecar={sidecar}
      store={store}
      initialAngles={initialAngles}
      palette={palette}
      frame={frame}
      fit={fit}
      background={background}
      accent={accent}
      render={render}
      materials={finish === "pc" ? pcFinish : undefined}
      opening={opening}
      ar={ar}
      active={active}
      mobile={mobile}
      reduced={reduced}
      onReady={onReady}
      onFail={onFail}
    >
      {fillFrom && <directionalLight position={fillFrom} intensity={fillIntensity} />}
      {armed && (
        <Suspense fallback={null}>
          <PowerScene reduced={!!reduced} />
        </Suspense>
      )}
    </ExplodeStage>
  );
}
