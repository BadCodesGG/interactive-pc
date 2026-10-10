# Context

Glossary for blowout-pc (Interactive PC). Terms are the ones the code and README already use; add new ones as the domain model sharpens.

## Terms

- **Exploded view**: the `/` page. The PC pulls apart on a slider in three stages.
- **Stage**: a slice of the explode slider. Groups carry a `stage`; stages split the slider evenly. Not to be confused with the 3D stage (the canvas scene).
- **Part**: one of the 18 procedural PC components, one named node each, built in code under `src/models/pc/`.
- **Group**: a set of parts that move together in the explode plan.
- **Sidecar**: `src/data/<feature>.sidecar.json`, schema 1; parts keyed by node name, with labels, groups, stages and copy keys.
- **Copy book**: `src/data/<feature>.copy.ts`, one typed entry per sidecar copy key.
- **Feature**: a model plus its sidecar and copy book, rendered by the shared engine at `src/engine/explode/`.
- **X-ray**: fades the chassis so inner parts show.
- **Heat overlay**: per-part tint from TDP and case airflow (`src/data/thermal.ts`). Numbers are invented.
- **Power on**: fans spin up in order, RGB fades up, boot screen prints.
- **Build game**: the `/build` page, where the player fits parts in order.
- **Mode**: one of five game modes (`src/data/modes.ts`): Guided, Free, Brief, Won't boot, Speedrun.
- **Tier**: Easy, Normal, Hard or Expert; sets slot highlights, rejection explanations, penalties and a hidden rule.
- **Rule**: one of the eleven compatibility checks in `src/data/rules.ts`.
- **Fault**: a defect planted in a Won't boot build for the player to find and fix before power on.
- **Brief**: a client's job and budget; the player shops for parts, then builds.
- **Spec sheet**: the list of picks with status and an invented performance estimate.
- **Share link**: the picks encoded in one `?b=` parameter, read on the server; opens in Free mode. A bad value falls back to the shipped build.
- **Best time**: stars first, then time, kept per mode and tier in localStorage.
