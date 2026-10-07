import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeModel, loadModel, preloadModel } from "@/engine/explode/loader";
import "./register";

afterEach(() => vi.unstubAllGlobals());

describe("the procedural model source", () => {
  it("builds a procedural model from the registry, without fetching, fresh on every load", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const [a, b] = await Promise.all([loadModel("procedural:pc"), loadModel("procedural:pc")]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(a.getObjectByName("cpu")).toBeTruthy();
    expect(a).not.toBe(b);
    disposeModel(a);
    expect(b.getObjectByName("cooler")).toBeTruthy();
  });

  it("names an unknown procedural model in its error", async () => {
    await expect(loadModel("procedural:nope")).rejects.toThrow(/procedural model "nope"/);
  });

  it("preloads without fetching and without throwing for an unknown name", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(() => preloadModel("procedural:pc")).not.toThrow();
    expect(() => preloadModel("procedural:nope")).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
