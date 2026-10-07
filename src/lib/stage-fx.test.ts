import { describe, expect, it } from "vitest";
import { createStageFx } from "./stage-fx";

describe("stage fx store", () => {
  it("starts with the heat overlay off and the machine off", () => {
    expect(createStageFx().getState()).toEqual({ heat: false, power: false });
  });

  it("toggles each switch on its own, telling subscribers once per change", () => {
    const fx = createStageFx();
    let calls = 0;
    const off = fx.subscribe(() => calls++);
    fx.setHeat(true);
    fx.setHeat(true);
    expect(calls).toBe(1);
    fx.setPower(true);
    expect(fx.getState()).toEqual({ heat: true, power: true });
    off();
    fx.setHeat(false);
    expect(calls).toBe(2);
  });

  it("returns the same state object until something changes, which useSyncExternalStore needs", () => {
    const fx = createStageFx();
    const a = fx.getState();
    fx.setPower(false);
    expect(fx.getState()).toBe(a);
    fx.setPower(true);
    expect(fx.getState()).not.toBe(a);
  });

  it("resets to the start", () => {
    const fx = createStageFx();
    fx.setHeat(true);
    fx.setPower(true);
    fx.reset();
    expect(fx.getState()).toEqual({ heat: false, power: false });
  });
});
