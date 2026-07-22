import { describe, expect, it, vi } from "vitest";
import { AlarmWorkerController } from "./alarmWorkerController";

const createHarness = () => {
  let now = 1_000_000;
  let nextTimerId = 0;
  let pendingTimer: (() => void) | null = null;
  const setTimer = vi.fn((callback: () => void) => {
    pendingTimer = callback;
    nextTimerId += 1;
    return nextTimerId;
  });
  const clearTimer = vi.fn();
  const postWake = vi.fn();
  const controller = new AlarmWorkerController({
    now: () => now,
    setTimer,
    clearTimer,
    postWake,
  });

  return {
    controller,
    setNow: (value: number) => {
      now = value;
    },
    fireTimer: () => {
      const callback = pendingTimer;
      if (!callback) {
        throw new Error("No timer is scheduled.");
      }
      pendingTimer = null;
      callback();
    },
    setTimer,
    clearTimer,
    postWake,
  };
};

describe("AlarmWorkerController", () => {
  it("schedules one absolute wake instead of polling on a throttled window interval", () => {
    const { controller, setTimer } = createHarness();

    controller.schedule(1_030_000);

    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });

  it("posts the target timestamp when the absolute alarm boundary is reached", () => {
    const { controller, fireTimer, postWake, setNow } = createHarness();
    controller.schedule(1_030_000);
    setNow(1_030_005);

    fireTimer();

    expect(postWake).toHaveBeenCalledWith(1_030_000, 1_030_005);
  });

  it("does not fire early when the wall clock moves backwards", () => {
    const { controller, fireTimer, postWake, setNow, setTimer } = createHarness();
    controller.schedule(1_030_000);
    setNow(1_020_000);

    fireTimer();

    expect(postWake).not.toHaveBeenCalled();
    expect(setTimer).toHaveBeenLastCalledWith(expect.any(Function), 10_000);
  });

  it("replaces and cancels stale alarm wakeups", () => {
    const { controller, clearTimer } = createHarness();
    controller.schedule(1_030_000);
    controller.schedule(1_060_000);
    controller.cancel();

    expect(clearTimer).toHaveBeenCalledTimes(2);
  });
});
