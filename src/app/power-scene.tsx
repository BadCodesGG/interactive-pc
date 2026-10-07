"use client";

/**
 * Power on, in the canvas: the fans spin up in the order `feedback.fanSpinUp` gives and the RGB
 * (`rgb-idle`) fades up from dark, and stay on until the machine is switched off, when the fans run
 * down. Under reduced motion the fans do not spin and the lights do not fade.
 *
 * Its own lazy chunk (stage.tsx imports it with React.lazy and mounts it on the first press), so none of
 * this is in the stage chunk or downloaded by a visitor who never presses Power on. It reads the power
 * switch from the shared store in src/lib/stage-fx.ts.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { feedback } from "@/data/assembly";
import { useStageScene } from "@/engine/explode/stage";
import { stageFx } from "@/lib/stage-fx";

interface Rotor {
  obj: THREE.Object3D;
  rate: number;
  delay: number;
  speed: number;
}
interface Lit {
  mat: THREE.MeshStandardMaterial;
  full: number;
}

/** How quickly a fan runs down once switched off (per second). */
const RUN_DOWN = 2.5;

interface PowerRig {
  rotors: Rotor[];
  lit: Lit[];
  /** Seconds since the last press of Power on; negative while the machine is off. */
  since: number;
}

function buildRig(parts: Map<string, THREE.Object3D>): PowerRig {
  const rotors: Rotor[] = [];
  const lit: Lit[] = [];
  const order = feedback.fanSpinUp.order as string[];
  for (const [id, obj] of parts) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && typeof o.userData.rgb === "number") lit.push({ mat: m.material as THREE.MeshStandardMaterial, full: o.userData.rgb });
      if (typeof o.userData.spin === "number") {
        const i = order.indexOf(id);
        rotors.push({ obj: o, rate: o.userData.spin, delay: (i < 0 ? order.length : i) * (feedback.fanSpinUp.staggerMs / 1000), speed: 0 });
      }
    });
  }
  return { rotors, lit, since: -1 };
}

/** The switch moved. Power on starts from dark and brings the lights up; under reduced motion they just stay lit. */
function setPower(rig: PowerRig, on: boolean, reduced: boolean) {
  rig.since = on ? 0 : -1;
  const dark = on && !reduced;
  for (const l of rig.lit) l.mat.emissiveIntensity = dark ? 0 : l.full;
}

function lightsOn(rig: PowerRig) {
  for (const l of rig.lit) l.mat.emissiveIntensity = l.full;
}

/** One frame: fans spin up in order (or run down), the lights fade up. Returns whether anything is still moving. */
function stepPower(rig: PowerRig, dt: number, reduced: boolean): boolean {
  const on = rig.since >= 0;
  if (on) rig.since += dt;
  let moving = false;
  const ramp = feedback.fanSpinUp.rampMs / 1000;
  for (const r of rig.rotors) {
    if (reduced) {
      r.speed = 0;
      continue;
    }
    r.speed = on ? Math.min(Math.max((rig.since - r.delay) / ramp, 0), 1) ** 2 : r.speed * Math.exp(-RUN_DOWN * dt);
    if (r.speed < 1e-3 && !on) r.speed = 0;
    if (r.speed > 0) {
      r.obj.rotation.y += r.rate * r.speed * dt;
      moving = true;
    }
  }
  if (on && !reduced) {
    const fade = Math.min(rig.since / (feedback.rgb.fadeMs / 1000), 1);
    for (const l of rig.lit) l.mat.emissiveIntensity = l.full * fade;
    if (fade < 1) moving = true;
  }
  return moving;
}

export default function PowerScene({ reduced }: { reduced: boolean }) {
  const { parts, invalidate } = useStageScene();
  const rig = useMemo(() => buildRig(parts), [parts]);

  useEffect(() => {
    // The store also carries the heat switch: only a change of power may restart the sequence.
    let power: boolean | null = null;
    const apply = () => {
      const next = stageFx.getState().power;
      if (next === power) return;
      power = next;
      setPower(rig, next, reduced);
      invalidate();
    };
    apply();
    const off = stageFx.subscribe(apply);
    return () => {
      off();
      // Back to the model as authored when this layer goes away.
      lightsOn(rig);
      invalidate();
    };
  }, [rig, reduced, invalidate]);

  useFrame((_, delta) => {
    if (stepPower(rig, Math.min(delta, 1 / 20), reduced)) invalidate();
  });

  return null;
}
