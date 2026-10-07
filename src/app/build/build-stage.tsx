"use client";

import { pcSidecar } from "@/data/pc";
import { useExplodeStore, type GateRenderProps } from "@/engine/explode";
import ExplodeStage from "@/engine/explode/stage";
import { GameScene } from "@/game/scene";
import type { GameStore } from "@/game/store";
import { pcFinish } from "@/models/pc/finish";
import { STAGE_ACCENT, STAGE_BACKGROUND, STAGE_PALETTE, STAGE_RENDER } from "../stage-look";

/** From the front left and a little higher than the explode page, so the tray arc is in view. */
const ANGLES: [number, number] = [-0.35, 1.02];
const FILL: [number, number, number] = [9, 3, 5];

export interface BuildStageProps {
  game: GameStore;
  /** The machine is already built and the case is open: frame the machine, not the tray that is empty. */
  wontBoot?: boolean;
  /** A part picked in 3D (or null for empty space). */
  onPick: (id: string | null) => void;
}

/** The lazy chunk's entry for /build: the explode stage with the game layer inside it. */
export default function BuildStage({ game, onPick, wontBoot = false, active, mobile, reduced, onReady, onFail }: GateRenderProps & BuildStageProps) {
  const store = useExplodeStore();
  return (
    <ExplodeStage
      sidecar={pcSidecar}
      store={store}
      initialAngles={ANGLES}
      // Both poses at once and never refit: the game moves parts between the tray and the slots. Won't
      // boot has nothing on the tray, so the union would frame empty space: it fits the built machine.
      fit={wontBoot ? "pose" : "union"}
      frame={wontBoot ? 1.05 : 0.9}
      palette={STAGE_PALETTE}
      background={STAGE_BACKGROUND}
      accent={STAGE_ACCENT}
      render={STAGE_RENDER}
      materials={pcFinish}
      focusOnSelect={false}
      onSelect={onPick}
      active={active}
      mobile={mobile}
      reduced={reduced}
      onReady={onReady}
      onFail={onFail}
    >
      <directionalLight position={FILL} intensity={0.9} />
      <GameScene game={game} reduced={reduced} />
    </ExplodeStage>
  );
}
