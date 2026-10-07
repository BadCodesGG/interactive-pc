# Interactive PC

**An 18-part gaming PC you pull apart in 3D, and a game where you build it.**
X-ray, a heat overlay from TDP and airflow, a power-on boot, and a five-mode build game.

**Live: [pc.badcodes.dev](https://pc.badcodes.dev)**

<!-- demo-video -->

The machine comes apart on a slider. Pick any part, in 3D or from the list, to read what it does. A second page, `/build`, turns the same PC into a build game with compatibility rules, a spec sheet and share links. The 18 parts are generated in code, so there is no model file to download.

## What you can do

At `/` the machine pulls apart in three stages: the panels, then the card, drives, power and fans, then the cooler, memory and CPU off the board.

| | |
|---|---|
| **Exploded view** | Drag the slider to take the PC apart. Pick a part in 3D or in the list to focus it and read its copy. |
| **X-ray** | Fades the chassis so the parts inside show. |
| **Heat overlay** | Tints each part from its TDP and the case airflow (`src/data/thermal.ts`). The numbers are invented, and the legend says so. |
| **Power on** | Spins the fans up in order, fades the RGB up and prints a boot screen over the stage. |

`/build` is the build game: pick each part from the tray and fit it in the right order, from the power supply to the first boot. Everything works from the keyboard with no canvas; the 3D scene is a lazy enhancement.

- **Five modes** (`src/data/modes.ts`): Guided (step by step, the next slot glows), Free (a sandbox with no clock), Brief (a client's job and budget, shop for the parts, then build), Won't boot (a finished PC with up to three faults to find and fix before you press power) and Speedrun (fixed parts and a clock).
- **Four tiers**, Easy, Normal, Hard and Expert, each mode offering some of them. Tiers change the slot highlights, whether a rejection explains itself, how mistakes are punished (time, stars or both) and whether one rule stays hidden until power on.
- **Eleven compatibility rules** (`src/data/rules.ts`): board and case, CPU socket, BIOS support, memory, cooler fit and heat, tall memory under a tower cooler, graphics card size, PSU headroom, access order and case fan orientation.
- **A spec sheet** lists every pick with its status and an estimate of what it will run, by game genre and resolution (also invented). Parts can be swapped from it in Free and Brief; the 3D model always stays the shipped build.
- **Share links**: the picks are one short `?b=` parameter, read on the server, so a shared build opens in Free with its sheet already filled in. A bad value falls back to the shipped build.
- **Best times**: stars first, then time, kept per mode and tier in the browser's localStorage. Nothing is sent anywhere.

## How it works

The site is built on a shared exploded-view engine, `src/engine/explode/`: a data-driven Next.js 16 setup where a feature is three files plus a route.

| File | Holds |
|---|---|
| `public/models/<feature>.<hash>.glb` | Geometry: Meshopt-compressed, one named node per part, a content hash in the name. The PC has none; its sidecar names `procedural:pc` and `src/models/pc/` builds it in code. |
| `src/data/<feature>.sidecar.json` | Schema 1: parts keyed by node name, labels, groups and stages, optional explode vectors and camera views, copy keys. |
| `src/data/<feature>.copy.ts` | A typed copy book: one entry per sidecar copy key. |

The scene is React Three Fiber on three.js. The route page is a Server Component, so the headline, text and part list render into the HTML and the page works with JavaScript off. Only the canvas is lazy, loaded through `next/dynamic` with `ssr: false` and gated on WebGL 2.

```
src/app/              Routes: / (explode), /build (game), stage, overlays, boot screen
src/engine/explode/   The reusable engine: sidecar schema and loader, explode plan, camera, stage, AR export
src/models/pc/        The 18 procedural parts (chassis, board, cooler, gpu, psu, cables, fans)
src/data/             Sidecars, copy books, catalogue, compatibility rules, modes, scoring, thermal model
src/game/             The build game: store, state machine, faults, layout, 3D scene, audio
src/lib/              Share-link codec, stage effects store, heat ramp, site metadata
scripts/              Fixture builder, sidecar check, Chromium stage check
```

### Explode maths

Each part moves by its authored `explode` vector if it has one; otherwise radially from the assembly centre by `R * (0.35 + 0.65 * min(d / R, 1))`; a part at the centre moves along its thinnest axis. Groups carry a `stage`: stages split the slider evenly, so structure can come away before the mechanism, and a group's own `explode` vector adds to each of its parts. `assembly.axis` switches to a single-axis blueprint layout. `src/engine/explode/plan.test.ts` holds worked examples.

### Things to know before changing it

- **Import the stage only through `next/dynamic` with `ssr: false`, from a Client Component** (`stage-client.tsx`). The `@/engine/explode` barrel deliberately omits `stage`, `plan` and `camera`: importing any of them statically puts three into the route's initial JS. `test:stage` fails if `WebGLRenderer` appears in an initial chunk.
- **The sibling `import("three")` in `stage-client.tsx` is load-bearing.** It gives three its own chunk, fetched in parallel. Without it the bundler folds the engine into three's chunk and the stage budget (120 KB gzipped, three excluded) cannot be measured.
- **`<Canvas flat>`, never `<Canvas shadows>`.** Without `flat`, R3F's ACES tone mapping recolours every material; `shadows` selects `PCFSoftShadowMap`, which three 0.186 replaces with a warning. Shadows are switched on in `onCreated` with `PCFShadowMap`.
- **WebGL 2 only.** The probe in `gate.tsx` accepts only a `webgl2` context, so browsers with WebGL 1 never download three.
- **Per-frame values never go through React.** The store publishes `k` (the explode amount) only when a tween settles; the canvas reads the live value with `store.frameK()`.
- **Camera focus uses `fitToSphere`, not `fitToBox`.** camera-controls' `fitToBox` snaps to the nearest axis-aligned angle, which shows flat parts edge-on.
- **An authored `view` is for the exploded pose.** Write its `position` and `target` against where the part sits at k = 1.
- **Sidecar keys are node names after three's sanitiser.** three turns whitespace into `_` and drops `[ ] . : /`; the engine further requires `[A-Za-z0-9_-]`. A multi-primitive mesh's children take `<mesh>_1`-style names from the same pool, so a node named `gear_1` can collide. `npm run check:sidecar` loads each GLB through three's real GLTFLoader to catch this.
- **Never run `gltf-transform optimize` with defaults.** Its flatten, join, instance and palette steps merge named parts into one node. Pass `--flatten false --join false --instance false --palette false --simplify false --compress meshopt`, then run `npm run check:sidecar`.
- **Models are cached as immutable** (`next.config.ts`), so a changed GLB must be a new filename. `npm run fixture` shows the pattern: hash the bytes, write `<name>.<hash>.glb`, update the sidecar.
- **Any route that sets metadata goes through `pageMetadata()` in `src/lib/site.ts`.** A route that declares its own `openGraph` or `twitter` replaces the layout's wholesale and loses its picture; one that sets only `title` unfurls with the home page's title and URL. `SITE_URL` is the literal production domain, never `VERCEL_URL` or localhost, because a relative or deployment URL makes Slack and Facebook drop the image. `src/lib/site.test.ts` checks every route.
- **On `/build` the page owns the X-ray.** `build-game.tsx` sets it in one effect: heat first (fully faded), then the mode (Won't boot opens the case), otherwise 0. `StageOverlays` and `ThermalOverlay` take `ownsXray`; `/build` passes `false` so the overlay never writes it.
- **The stage-fx store (`src/lib/stage-fx.ts`) carries two switches, `heat` and `power`.** It sits outside React. `power-scene.tsx` re-applies only when `power` itself changed; reacting to every notification would restart the fan spin-up and the RGB fade each time the heat switch moves.
- **The share codec (`src/lib/share-build.ts`).** `?b=` is two characters per slot: a slot letter and the base 36 index into that kind's list. Decoding is an allow-list (lowercase letters and digits, at most 64 characters, known slot letters, in-range indexes) and the result is built from catalogue ids, never from the input. The order of every kind in `src/data/catalogue.ts` is the code and is pinned by `share-build.test.ts`: append new parts, never insert or reorder.
- **Procedural parts carry their animation in `userData`.** The `rgb` and `spin` values on a part's node are what `power-scene.tsx` animates.
- **Embedding.** `next.config.ts` sends `frame-ancestors 'self'` plus `https://badcodes.dev` and `https://www.badcodes.dev`, so only those origins can frame the pages. Change it if you host the site elsewhere.
- **Console output.** `test:stage` fails on any console error and on any `THREE.` warning except the `THREE.Clock` deprecation that R3F 9.8 triggers. It launches Chromium with SwiftShader, which prints no shader notes; a real Windows GPU prints harmless ANGLE D3D11 notes (X4122, X3595) through `THREE.WebGLProgram`.

## Running it

Node 22 or 24.

```bash
git clone https://github.com/BadCodesGG/interactive-pc.git
cd interactive-pc
npm install
npm run dev            # http://localhost:3000
```

Checks:

```bash
npm run lint           # ESLint (Next core-web-vitals + TypeScript)
npm run typecheck      # tsc --noEmit
npm test               # Vitest: engine maths, sidecar schema, store, loader, game rules
npm run build          # production build
npm run check:sidecar  # every src/data/*.sidecar.json against its model and copy book
npm run fixture        # rebuilds public/models/fixture.<hash>.glb and points its sidecar at it
```

`test:stage` needs a build first and Playwright's Chromium:

```bash
npx playwright install chromium
npm run build
npm run test:stage
```

It boots `next start` and drives both routes in Chromium: the explode checks on `/`, and on `/build` the server-rendered tray, a part placed from the keyboard, a wrong order refused with its reason, and a full Guided build ending on the boot screen. Both routes also check for zero console errors and hold the payload budgets. Screenshots go to `.stage-shots/` (override with `STAGE_SHOTS_DIR`); set `STAGE_URL` to test a server that is already running. Add every new feature route to `ROUTES` in `scripts/check-stage.mjs`.

The test fixture (`public/models/fixture.<hash>.glb` and `src/data/fixture.sidecar.json`) is a small nine-part model that the loader tests and the `/models/` cache-header check use.

## Credits and licence

The code is MIT, see [LICENSE](LICENSE).

The fan geometry is adapted from [pc-anatomy](https://github.com/Yoosseph/pc-anatomy) by Yoosseph, Copyright (c) 2026 Yoseph, MIT License. The licence text is kept in `src/models/pc/LICENSE-pc-anatomy.txt`, and the same credit appears in every page's footer (`src/data/credits.ts`).

The parts catalogue and its specs are invented; no real brand or product is implied.

Files that are not covered by the MIT licence, and the terms for the BadCodes name and logo, are listed in [NOTICE](NOTICE).

Built by [BadCodes](https://badcodes.dev).
