"use client";

/**
 * The build game's layer inside the explode stage's canvas (mounted as ExplodeStage children, so
 * it ships only in the lazy stage chunk). It never decides anything: it draws the state of the
 * game store and turns clicks and drags on ghost slots into `place` calls.
 *
 * - Unplaced parts stand on a tray arc, scaled down; placed parts sit in their slots (the board and
 *   its parts on the bench until the board goes into the case).
 * - Every open slot shows a faint ghost of its part. The tier decides which glow: Easy every valid
 *   slot, Normal the active step's, Hard none. While dragging, the slot within 2x its snap radius
 *   glows too (not on Hard) and a release within the snap radius places.
 * - Parts move with exponential damping, seat with a short squash, and shake back when refused.
 *   Under reduced motion they jump and never shake.
 * - Power on spins the fans in the order `feedback.fanSpinUp` gives and fades the RGB in.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { feedback } from "@/data/assembly";
import { tiers } from "@/data/modes";
import { useStageScene } from "@/engine/explode/stage";
import { slots as SLOTS } from "@/models/pc/build-pc";
import { pendingStepFor, stepReady, validSteps, type GameState } from "./machine";
import { BENCH_OFFSET, TRAY_ORDER, displayOffset, trayPosition } from "./layout";
import type { GameStore } from "./store";

const LAMBDA = 9;
const TRAY_SIZE = 1.5;
const SQUASH_S = feedback.snap.squashMs[1] / 1000;
const SHAKE_S = feedback.rejection.shakeMs / 1000;
const CABLE_S = 1.4;
const noRaycast = () => {};

interface PartRig {
  id: string;
  obj: THREE.Object3D;
  rest: THREE.Vector3;
  tray: THREE.Vector3;
  trayScale: number;
  pos: THREE.Vector3;
  scale: number;
  squashT: number;
  shakeT: number;
}

interface GhostRig {
  slotId: string;
  partId: string;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  fill: THREE.MeshBasicMaterial;
  line: THREE.LineDashedMaterial;
  glow: number;
}

function isPlaced(s: GameState, partId: string) {
  const next = pendingStepFor(s, partId);
  return !next || !!next.movesExisting;
}

/** Where an open slot is drawn: on the bench for the board's parts until the board moves into the case. */
function slotPosition(s: GameState, slotId: string, out: THREE.Vector3) {
  const slot = SLOTS[slotId];
  const next = pendingStepFor(s, slot.partId);
  const off = next && !next.movesExisting ? displayOffset(s, slot.partId) : [0, 0, 0];
  return out.set(slot.position[0] + off[0], slot.position[1] + off[1], slot.position[2] + off[2]);
}

function build(root: THREE.Object3D, parts: Map<string, THREE.Object3D>, accent: string) {
  root.updateMatrixWorld(true);
  const rigs = new Map<string, PartRig>();
  const ghostRoot = new THREE.Group();
  ghostRoot.name = "__build_ghosts";
  const ghosts: GhostRig[] = [];
  const disposables: { dispose(): void }[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const inv = new THREE.Matrix4();

  for (const id of TRAY_ORDER) {
    const obj = parts.get(id);
    if (!obj) continue;
    box.setFromObject(obj);
    box.getSize(size);
    box.getCenter(centre);
    const rest = obj.position.clone();
    const trayScale = Math.min(1, TRAY_SIZE / Math.max(size.x, size.y, size.z));
    // Stand the part on the floor at its tray spot, centred on it.
    const [tx, , tz] = trayPosition(id);
    const tray = new THREE.Vector3(tx - (centre.x - rest.x) * trayScale, 0.03 - (box.min.y - rest.y) * trayScale, tz - (centre.z - rest.z) * trayScale);
    rigs.set(id, { id, obj, rest, tray, trayScale, pos: tray.clone(), scale: trayScale, squashT: -1, shakeT: -1 });

    // The ghost: the part's own meshes (shared geometry), in one faint material, plus its box outline.
    const slotId = `slot_${id}`;
    const group = new THREE.Group();
    group.userData.slot = slotId;
    const fill = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.03, depthWrite: false });
    // Slot highlight: a dashed pcb outline with a pcb tint inside it.
    const line = new THREE.LineDashedMaterial({ color: accent, transparent: true, opacity: 0.08, depthWrite: false, dashSize: 0.09, gapSize: 0.06 });
    disposables.push(fill, line);
    inv.copy(obj.matrixWorld).invert();
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = new THREE.Mesh(m.geometry, fill);
      g.matrixAutoUpdate = false;
      g.matrix.multiplyMatrices(inv, m.matrixWorld);
      g.renderOrder = 2;
      meshes.push(g);
      group.add(g);
    });
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    disposables.push(edges);
    const outline = new THREE.LineSegments(edges, line);
    outline.computeLineDistances();
    outline.position.copy(centre).sub(rest);
    outline.raycast = noRaycast;
    group.add(outline);
    ghostRoot.add(group);
    ghosts.push({ slotId, partId: id, group, meshes, fill, line, glow: 0 });
  }

  // A stand for the board while it is on the bench.
  const board = rigs.get("motherboard");
  const standMat = new THREE.MeshStandardMaterial({ color: "#20242a", metalness: 0.5, roughness: 0.5 });
  const stand = new THREE.Group();
  const bx = board ? board.rest.x + BENCH_OFFSET[0] : 0;
  const bz = board ? board.rest.z + BENCH_OFFSET[2] : 0;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 2.2), standMat);
  base.position.set(bx + 0.3, 0.03, bz);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.48, 0.08), standMat);
  post.position.set(bx + 0.1, 0.77, bz);
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 2.3), standMat);
  cradle.position.set(bx + 0.05, 1.49, bz);
  stand.add(base, post, cradle);
  stand.traverse((o) => {
    o.castShadow = o.receiveShadow = true;
    o.raycast = noRaycast;
  });
  disposables.push(standMat, base.geometry, post.geometry, cradle.geometry);

  // RGB surfaces start dark; fans and cables are found once.
  const rgb: { mat: THREE.MeshStandardMaterial; full: number }[] = [];
  const rotors: { obj: THREE.Object3D; rate: number; delay: number }[] = [];
  const cables: THREE.Mesh[] = [];
  const order = feedback.fanSpinUp.order as string[];
  for (const [id, obj] of parts) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && typeof o.userData.rgb === "number") rgb.push({ mat: m.material as THREE.MeshStandardMaterial, full: o.userData.rgb });
      if (m.isMesh && o.userData.cable) cables.push(m);
      if (typeof o.userData.spin === "number") {
        const i = order.indexOf(id);
        rotors.push({ obj: o, rate: o.userData.spin, delay: (i < 0 ? order.length : i) * (feedback.fanSpinUp.staggerMs / 1000) });
      }
    });
  }

  return {
    rigs,
    ghosts,
    ghostRoot,
    stand,
    rgb,
    rotors,
    cables,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

export function GameScene({ game, reduced, accent = "#0b6b70" }: { game: GameStore; reduced: boolean; accent?: string }) {
  const { root, parts, getControls, invalidate } = useStageScene();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useMemo(() => build(root, parts, accent), [root, parts, accent]);
  const drag = useRef<Drag | null>(null);
  const fx = useRef<Fx>({ seq: 0, cableT: -1, powerT: -1, clock: 0 });

  useEffect(() => () => scene.dispose(), [scene]);

  // Parts start on the tray, RGB dark.
  useEffect(() => {
    for (const r of scene.rigs.values()) {
      r.obj.position.copy(r.tray);
      r.obj.scale.setScalar(r.trayScale);
    }
    setRgb(scene.rgb, 0);
    invalidate();
  }, [scene, invalidate]);

  // Events from the store: squash on a seat, shake on a refusal, cables draw, power on.
  useEffect(() => {
    const onChange = () => {
      const s = game.getState();
      const f = fx.current;
      if (s.last && s.last.seq !== f.seq) {
        f.seq = s.last.seq;
        const rig = scene.rigs.get(s.last.partId);
        if (s.last.kind === "placed" && rig) {
          rig.squashT = reduced ? -1 : 0;
          if (s.last.partId === "cables") f.cableT = reduced ? CABLE_S : 0;
        }
        if (s.last.kind === "rejected" && rig && !reduced) rig.shakeT = 0;
        if (s.last.kind === "powered") f.powerT = 0;
      }
      if (!s.last) {
        // Reset: lights off, fans still, cables whole.
        f.seq = 0;
        f.powerT = -1;
        f.cableT = -1;
        setRgb(scene.rgb, 0);
        for (const c of scene.cables) c.geometry.setDrawRange(0, Infinity);
      }
      invalidate();
    };
    return game.subscribe(onChange);
  }, [game, scene, reduced, invalidate]);

  // Drag from the tray: our own pointer handlers on a camera-facing plane (mouse and pen only).
  useEffect(() => {
    const el = gl.domElement;
    const host = el.parentElement ?? el;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const ray = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster;
    };
    const draggable = () => {
      const s = game.getState();
      if (s.finishedAt !== null) return [];
      return [...scene.rigs.values()].filter((r) => {
        const next = pendingStepFor(s, r.id);
        return next && stepReady(s, next);
      });
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      const rigs = draggable();
      const hits = ray(e).intersectObjects(rigs.map((r) => r.obj), true);
      if (!hits.length) return;
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !rigs.some((r) => r.obj === o)) o = o.parent;
      const rig = rigs.find((r) => r.obj === o);
      if (!rig) return;
      // Captured before camera-controls sees the event, so pressing a part never orbits.
      const controls = getControls();
      if (controls) controls.enabled = false;
      const normal = camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, rig.pos);
      const at = raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? rig.pos.clone();
      drag.current = { id: rig.id, x: e.clientX, y: e.clientY, active: false, plane, grab: rig.pos.clone().sub(at), at: rig.pos.clone(), near: null };
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      if (!d.active) {
        d.active = true;
        if (game.getState().selectedPart !== d.id) game.select(d.id);
      }
      if (ray(e).ray.intersectPlane(d.plane, hit)) d.at.copy(hit).add(d.grab);
      d.near = nearestSlot(game.getState(), d.id, d.at, NEAR).slotId;
      invalidate();
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      const controls = getControls();
      if (controls) controls.enabled = true;
      if (!d?.active) return;
      const target = nearestSlot(game.getState(), d.id, d.at, SNAP).slotId;
      if (target) game.place(d.id, target);
      invalidate();
    };
    host.addEventListener("pointerdown", down, { capture: true });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      host.removeEventListener("pointerdown", down, { capture: true });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, camera, game, scene, getControls, invalidate]);

  useFrame((_, delta) => {
    const d = drag.current?.active ? drag.current : null;
    if (stepScene(scene, game.getState(), d, fx.current, Math.min(delta, 1 / 20), reduced)) invalidate();
  });

  const onGhostClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const s = game.getState();
    const hits = e.intersections.map((i) => slotOf(i.object)).filter((x): x is string => !!x);
    if (!hits.length) return;
    if (!s.selectedPart) {
      game.say("Pick a part from the tray first, then click where it goes.");
      return;
    }
    const own = pendingStepFor(s, s.selectedPart)?.slotId;
    game.place(s.selectedPart, own && hits.includes(own) ? own : hits[0]);
  };

  return (
    <>
      <primitive object={scene.ghostRoot} onClick={onGhostClick} />
      <primitive object={scene.stand} />
    </>
  );
}

type Drag = { id: string; x: number; y: number; active: boolean; plane: THREE.Plane; grab: THREE.Vector3; at: THREE.Vector3; near: string | null };
type Fx = { seq: number; cableT: number; powerT: number; clock: number };
type Built = ReturnType<typeof build>;

/** One frame of the build scene. Returns whether anything is still moving (another frame is needed). */
function stepScene(scene: Built, s: GameState, d: Drag | null, f: Fx, dt: number, reduced: boolean): boolean {
f.clock += dt;
  const blend = reduced ? 1 : 1 - Math.exp(-LAMBDA * dt);
  let moving = false;
  const target = new THREE.Vector3();

  for (const r of scene.rigs.values()) {
    let scale = r.trayScale;
    if (d?.id === r.id) {
      target.copy(d.at);
      scale = 1;
    } else if (isPlaced(s, r.id)) {
      const off = displayOffset(s, r.id);
      target.set(r.rest.x + off[0], r.rest.y + off[1], r.rest.z + off[2]);
      scale = 1;
    } else target.copy(r.tray);
    if (d?.id === r.id) r.pos.copy(target);
    else if (r.pos.distanceToSquared(target) > 1e-6) {
      r.pos.lerp(target, blend);
      moving = true;
    } else r.pos.copy(target);
    if (Math.abs(r.scale - scale) > 1e-3) {
      r.scale += (scale - r.scale) * blend;
      moving = true;
    } else r.scale = scale;

    r.obj.position.copy(r.pos);
    let sy = 1;
    if (r.squashT >= 0) {
      r.squashT += dt;
      const u = Math.min(r.squashT / SQUASH_S, 1);
      sy = 1 - 0.12 * Math.sin(Math.PI * u);
      if (u >= 1) r.squashT = -1;
      moving = true;
    }
    if (r.shakeT >= 0) {
      r.shakeT += dt;
      const u = Math.min(r.shakeT / SHAKE_S, 1);
      r.obj.position.x += 0.14 * Math.sin(u * Math.PI * 6) * (1 - u);
      if (u >= 1) r.shakeT = -1;
      moving = true;
    }
    r.obj.scale.set(r.scale, r.scale * sy, r.scale);
  }
  scene.stand.visible = !s.placed.has("board_case");

  const glowing = updateGhosts(scene.ghosts, s, d?.near ?? null, dt, f.clock, reduced);

  // Cables draw along their length when they go in.
  if (f.cableT >= 0 && f.cableT < CABLE_S) {
    f.cableT += dt;
    const p = Math.min(f.cableT / CABLE_S, 1);
    for (const c of scene.cables) {
      const count = c.geometry.index?.count ?? 0;
      c.geometry.setDrawRange(0, Math.floor((count * p) / 3) * 3);
    }
    moving = true;
  }

  // Power on: fans spin up in order, RGB fades in.
  if (f.powerT >= 0) {
    f.powerT += dt;
    const ramp = feedback.fanSpinUp.rampMs / 1000;
    for (const r of scene.rotors) {
      const u = Math.min(Math.max((f.powerT - r.delay) / ramp, 0), 1);
      r.obj.rotation.y += r.rate * u * u * dt * (reduced ? 0.25 : 1);
    }
    const fade = Math.min(f.powerT / (feedback.rgb.fadeMs / 1000), 1);
    setRgb(scene.rgb, fade);
    moving = true;
  }

  return moving || glowing || !!d;
}

function setRgb(list: { mat: THREE.MeshStandardMaterial; full: number }[], k: number) {
  for (const l of list) l.mat.emissiveIntensity = l.full * k;
}

/** Ghosts: shown for open slots, glowing by tier or drag proximity. Returns whether any glows. */
function updateGhosts(ghosts: GhostRig[], s: GameState, near: string | null, dt: number, clock: number, reduced: boolean): boolean {
  const tier = tiers[s.tier];
  const valid = new Set(validSteps(s).map((x) => x.slotId));
  let glowing = false;
  for (const g of ghosts) {
    const next = pendingStepFor(s, g.partId);
    const visible = !!next && s.finishedAt === null;
    g.group.visible = visible;
    for (const m of g.meshes) m.raycast = visible ? THREE.Mesh.prototype.raycast : noRaycast;
    if (!visible) continue;
    slotPosition(s, g.slotId, g.group.position);
    const byTier = tier.highlights === "all-valid" ? valid.has(g.slotId) : tier.highlights === "while-dragging" ? next.id === s.activeStep : false;
    // Forgiving: wherever slots light at all, a picked part's slot lights from the moment it is picked.
    const picked = tier.highlights !== "none" && s.selectedPart === g.partId;
    const isNear = tier.highlights !== "none" && near === g.slotId;
    const want = byTier || isNear || picked ? 1 : 0;
    g.glow += (want - g.glow) * (reduced ? 1 : 1 - Math.exp(-10 * dt));
    const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(clock * 4);
    g.fill.opacity = 0.03 + g.glow * (isNear ? 0.4 : 0.26) * pulse;
    g.line.opacity = 0.1 + g.glow * 0.9 * pulse;
    if (g.glow > 0.01) glowing = true;
  }
  return glowing;
}

function slotOf(o: THREE.Object3D | null): string | null {
  for (let x = o; x; x = x.parent) if (typeof x.userData.slot === "string") return x.userData.slot;
  return null;
}

const tmpSlot = new THREE.Vector3();

/**
 * A forgiving snap: a drop lands within 1.6 times a slot's radius, and the slot lights up from
 * 2.5 times it, so the highlight always shows before the drop would miss.
 */
const SNAP = 1.6;
const NEAR = 2.5;

/** The open slot nearest `at`, if it is within `factor` times that slot's snap radius. */
function nearestSlot(s: GameState, partId: string, at: THREE.Vector3, factor: number): { slotId: string | null } {
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of TRAY_ORDER) {
    const next = pendingStepFor(s, id);
    if (!next) continue;
    const slotId = `slot_${id}`;
    const dist = slotPosition(s, slotId, tmpSlot).distanceTo(at);
    if (dist <= SLOTS[slotId].snapRadius * factor && dist < bestD) {
      bestD = dist;
      best = slotId;
    }
  }
  // Prefer the dragged part's own slot when it is in range: neighbouring memory slots overlap.
  const own = pendingStepFor(s, partId)?.slotId;
  if (own && own !== best && slotPosition(s, own, tmpSlot).distanceTo(at) <= SLOTS[own].snapRadius * factor) return { slotId: own };
  return { slotId: best };
}
