import { describe, expect, it, vi } from "vitest";
import { AudioAlarmScheduler } from "./audioAlarmScheduler";

const HOUR_MS = 60 * 60 * 1_000;

const createHarness = () => {
  const clock = { now: 1_000_000 };
  const startedAt: number[] = [];
  const stopped = vi.fn();
  const disconnected = vi.fn();
  const sources: Array<{
    buffer: AudioBuffer | null;
    connect: ReturnType<typeof vi.fn>;
    start: (when: number) => void;
    stop: typeof stopped;
    disconnect: typeof disconnected;
    onended: (() => void) | null;
  }> = [];

  const context = {
    currentTime: 12.5,
    state: "running" as AudioContextState,
    destination: {},
    onstatechange: null as (() => void) | null,
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 1 } as AudioBuffer)),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        connect: vi.fn(),
        start: (when: number) => startedAt.push(when),
        stop: stopped,
        disconnect: disconnected,
        onended: null,
      };
      sources.push(source);
      return source;
    }),
  };
  const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));

  const scheduler = new AudioAlarmScheduler({
    createAudioContext: () => context as unknown as AudioContext,
    fetchArrayBuffer,
    now: () => clock.now,
  });

  return {
    clock,
    context,
    scheduler,
    sources,
    startedAt,
    stopped,
    disconnected,
    fetchArrayBuffer,
  };
};

describe("AudioAlarmScheduler", () => {
  it("bounds a never-resolving audio activation and allows retry", async () => {
    vi.useFakeTimers();
    try {
      const { context, scheduler } = createHarness();
      context.state = "suspended";
      context.resume.mockImplementationOnce(() => new Promise<void>(() => {}));
      let outcome = "pending";
      void scheduler.enable().then(
        () => {
          outcome = "ready";
        },
        (error: Error) => {
          outcome = error.message;
        }
      );

      await vi.advanceTimersByTimeAsync(10_001);
      expect(outcome).toMatch(/timed out/);
      expect(scheduler.isReady).toBe(false);
      await scheduler.enable();
      expect(scheduler.isReady).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["fetch", "decode"] as const)(
    "bounds a stalled sound %s without scheduling it after retry",
    async (stage) => {
      vi.useFakeTimers();
      try {
        const { context, fetchArrayBuffer, scheduler, startedAt } = createHarness();
        let finish: (() => void) | undefined;
        if (stage === "fetch") {
          fetchArrayBuffer.mockImplementationOnce(
            () => new Promise<ArrayBuffer>((resolve) => {
              finish = () => resolve(new ArrayBuffer(8));
            })
          );
        } else {
          context.decodeAudioData.mockImplementationOnce(
            () => new Promise<AudioBuffer>((resolve) => {
              finish = () => resolve({ duration: 1 } as AudioBuffer);
            })
          );
        }
        await scheduler.enable();
        let outcome = "pending";
        void scheduler.scheduleHourly("/sound/stalled.wav", 1_030_000, 1).then(
          () => {
            outcome = "scheduled";
          },
          (error: Error) => {
            outcome = error.message;
          }
        );

        await vi.advanceTimersByTimeAsync(10_001);
        expect(outcome).toMatch(/timed out/);
        expect(scheduler.isScheduled(1_030_000)).toBe(false);
        await scheduler.scheduleHourly("/sound/retry.wav", 1_060_000, 1);
        finish?.();
        await vi.advanceTimersByTimeAsync(0);
        expect(startedAt).toHaveLength(1);
        expect(scheduler.isScheduled(1_030_000)).toBe(false);
        expect(scheduler.isScheduled(1_060_000)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("uses the Web Audio clock to schedule exact hourly start times", async () => {
    const { scheduler, startedAt } = createHarness();

    await scheduler.enable();
    const scheduled = await scheduler.scheduleHourly(
      "/sound/alarm.wav",
      1_030_000,
      2
    );

    expect(scheduled).toEqual([1_030_000, 1_030_000 + HOUR_MS]);
    expect(startedAt).toEqual([42.5, 3_642.5]);
  });

  it("tracks whether the specific alarm boundary is actually scheduled", async () => {
    const { scheduler, sources } = createHarness();
    const alarmAt = 1_030_000;

    expect(scheduler.isScheduled(alarmAt)).toBe(false);
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", alarmAt, 1);
    expect(scheduler.isScheduled(alarmAt)).toBe(true);

    sources[0].onended?.();
    expect(scheduler.isScheduled(alarmAt)).toBe(true);

    scheduler.cancel();
    expect(scheduler.isScheduled(alarmAt)).toBe(false);
  });

  it("does not treat a running context as a confirmed schedule", async () => {
    const { fetchArrayBuffer, scheduler } = createHarness();
    const alarmAt = 1_030_000;
    fetchArrayBuffer.mockRejectedValueOnce(new Error("network failed"));

    await scheduler.enable();
    await expect(
      scheduler.scheduleHourly("/sound/missing.wav", alarmAt, 1)
    ).rejects.toThrow("network failed");

    expect(scheduler.isReady).toBe(true);
    expect(scheduler.isScheduled(alarmAt)).toBe(false);
  });

  it("advances to the next exact boundary when loading crosses the target", async () => {
    const { clock, fetchArrayBuffer, scheduler, startedAt } = createHarness();
    fetchArrayBuffer.mockImplementationOnce(async () => {
      clock.now = 1_030_001;
      return new ArrayBuffer(8);
    });

    await scheduler.enable();
    const scheduled = await scheduler.scheduleHourly(
      "/sound/slow.wav",
      1_030_000,
      1
    );

    expect(scheduled).toEqual([1_030_000 + HOUR_MS]);
    expect(startedAt[0]).toBeCloseTo(3_612.499, 3);
  });

  it("refills the rolling schedule without cancelling existing sources", async () => {
    const { scheduler, startedAt, stopped } = createHarness();
    const firstAlarmAt = 1_030_000;

    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", firstAlarmAt, 2);
    await scheduler.ensureHourlySchedule(
      "/sound/alarm.wav",
      firstAlarmAt + 2 * HOUR_MS,
      2
    );

    expect(startedAt).toHaveLength(4);
    expect(stopped).not.toHaveBeenCalled();
    expect(scheduler.isScheduled(firstAlarmAt + 3 * HOUR_MS)).toBe(true);
  });

  it("keeps both minute families scheduled for the same sound", async () => {
    const { scheduler, startedAt, stopped } = createHarness();
    const nextFifty = 1_030_000;
    const nextHour = 1_630_000;

    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", nextFifty, 2);
    await scheduler.ensureHourlySchedule("/sound/alarm.wav", nextHour, 2);

    expect(startedAt).toHaveLength(4);
    expect(stopped).not.toHaveBeenCalled();
    expect(scheduler.isScheduled(nextFifty)).toBe(true);
    expect(scheduler.isScheduled(nextHour)).toBe(true);
  });

  it("cancels previously scheduled sources before replacing the sound", async () => {
    const { scheduler, stopped, disconnected } = createHarness();

    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/first.wav", 1_030_000, 2);
    await scheduler.scheduleHourly("/sound/second.wav", 1_060_000, 1);

    expect(stopped).toHaveBeenCalledTimes(2);
    expect(disconnected).toHaveBeenCalledTimes(2);
  });

  it("realigns both minute families after the audio clock resumes", async () => {
    const { clock, context, scheduler, startedAt, stopped } = createHarness();
    const firstAlarmAt = 1_030_000;
    const secondAlarmAt = 1_060_000;
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", firstAlarmAt, 2);
    await scheduler.ensureHourlySchedule("/sound/alarm.wav", secondAlarmAt, 1);

    clock.now += 10_000;
    context.currentTime += 10;
    context.state = "suspended";
    context.onstatechange?.();
    expect(scheduler.isScheduled(firstAlarmAt)).toBe(false);

    clock.now += 15_000;
    context.state = "running";
    context.onstatechange?.();

    expect(stopped).toHaveBeenCalledTimes(3);
    expect(startedAt.slice(3)).toEqual([27.5, 3_627.5, 57.5]);
    expect(scheduler.isScheduled(firstAlarmAt)).toBe(true);
    expect(scheduler.isScheduled(secondAlarmAt)).toBe(true);
  });

  it("drops an unstarted overdue source while retaining both future families", async () => {
    const { clock, context, scheduler, startedAt, stopped } = createHarness();
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 2);
    await scheduler.ensureHourlySchedule("/sound/alarm.wav", 1_090_000, 1);
    context.state = "suspended";
    context.onstatechange?.();
    clock.now += 75_000;
    context.state = "running";
    context.onstatechange?.();

    expect(stopped).toHaveBeenCalledTimes(3);
    expect(startedAt.slice(3)).toEqual([3_567.5, 27.5]);
    expect(scheduler.isScheduled(1_030_000)).toBe(false);
    expect(scheduler.isScheduled(1_090_000)).toBe(true);
    expect(scheduler.isScheduled(4_630_000)).toBe(true);
  });

  it("preserves confirmation of an already-started occurrence during drift repair", async () => {
    const { clock, context, scheduler, startedAt } = createHarness();
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 2);
    clock.now += 45_000;
    context.currentTime += 35;
    scheduler.reconcileClock();

    expect(scheduler.isScheduled(1_030_000)).toBe(true);
    expect(startedAt.slice(2)).toEqual([3_632.5]);
  });

  it("does not churn sources for normal sub-quantum clock sampling jitter", async () => {
    const { clock, scheduler, startedAt, stopped } = createHarness();
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 2);
    clock.now += 5;
    scheduler.reconcileClock();
    expect(stopped).not.toHaveBeenCalled();
    expect(startedAt).toEqual([42.5, 3_642.5]);
  });

  it("checks silent audio-clock drift before refilling existing sources", async () => {
    const { clock, scheduler, startedAt, stopped } = createHarness();
    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 2);
    clock.now += 10_000;

    await scheduler.ensureHourlySchedule("/sound/alarm.wav", 1_030_000, 2);

    expect(stopped).toHaveBeenCalledTimes(2);
    expect(startedAt.slice(2)).toEqual([32.5, 3_632.5]);
  });

  it("does not resurrect a cancelled schedule when sound loading finishes", async () => {
    const { fetchArrayBuffer, scheduler, startedAt } = createHarness();
    let finishLoad: ((data: ArrayBuffer) => void) | undefined;
    fetchArrayBuffer.mockImplementationOnce(
      () => new Promise<ArrayBuffer>((resolve) => { finishLoad = resolve; })
    );
    await scheduler.enable();
    const operation = scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 1);
    const rejected = expect(operation).rejects.toThrow("replaced while loading");
    scheduler.cancel();
    finishLoad?.(new ArrayBuffer(8));
    await rejected;
    expect(startedAt).toEqual([]);
    expect(scheduler.isScheduled(1_030_000)).toBe(false);
  });

  it("reports AudioContext lifecycle state changes", async () => {
    const { context, scheduler } = createHarness();
    const listener = vi.fn();
    scheduler.onStateChange(listener);

    await scheduler.enable();
    context.state = "suspended";
    context.onstatechange?.();

    expect(listener).toHaveBeenLastCalledWith("suspended");
  });

  it("can create a new context while a previous context is closing", async () => {
    let finishClose: (() => void) | undefined;
    const closePromise = new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    const firstContext = {
      state: "running" as AudioContextState,
      onstatechange: null,
      close: vi.fn(() => closePromise),
    };
    const secondContext = {
      state: "running" as AudioContextState,
      onstatechange: null,
    };
    const createAudioContext = vi
      .fn()
      .mockReturnValueOnce(firstContext)
      .mockReturnValueOnce(secondContext);
    const scheduler = new AudioAlarmScheduler({
      createAudioContext: () => createAudioContext() as AudioContext,
    });

    await scheduler.enable();
    const disposing = scheduler.dispose();
    await scheduler.enable();
    finishClose?.();
    await disposing;

    expect(createAudioContext).toHaveBeenCalledTimes(2);
    expect(scheduler.isReady).toBe(true);
  });
});
