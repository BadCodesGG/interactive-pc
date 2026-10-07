/**
 * Registers the app's model sources with the engine's loader: a sidecar whose `model` is
 * `"procedural:<name>"` is built by the generator in ./registry.ts. Import this for its side effect
 * from every module that starts a stage (src/app/stage-client.tsx, src/app/build/build-game.tsx),
 * before the first loadModel or preloadModel can run.
 *
 * It stays in a route's initial JS, so it imports only the light registry and the loader; the
 * generator (and three with it) is a dynamic import inside the registry, fetched when the stage asks.
 */
import { registerModelSource } from "@/engine/explode/loader";
import { loadProcedural, PROCEDURAL_PREFIX } from "./registry";

registerModelSource(PROCEDURAL_PREFIX, {
  load: async (name) => (await loadProcedural(name))().root,
  preload: (name) => loadProcedural(name),
});
