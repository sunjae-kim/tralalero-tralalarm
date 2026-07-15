import { describe, expect, it, vi } from "vitest";
import { AudioAlarmScheduler } from "./audioAlarmScheduler";

const createHarness = () => {
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
    resume: vi.fn(async () => undefined),
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

  const scheduler = new AudioAlarmScheduler({
    createAudioContext: () => context as unknown as AudioContext,
    fetchArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    now: () => 1_000_000,
  });

  return { context, scheduler, sources, startedAt, stopped, disconnected };
};

describe("AudioAlarmScheduler", () => {
  it("uses the Web Audio clock to schedule exact hourly start times", async () => {
    const { scheduler, startedAt } = createHarness();

    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/alarm.wav", 1_030_000, 2);

    expect(startedAt).toEqual([42.5, 3_642.5]);
  });

  it("cancels previously scheduled sources before rescheduling", async () => {
    const { scheduler, stopped, disconnected } = createHarness();

    await scheduler.enable();
    await scheduler.scheduleHourly("/sound/first.wav", 1_030_000, 2);
    await scheduler.scheduleHourly("/sound/second.wav", 1_060_000, 1);

    expect(stopped).toHaveBeenCalledTimes(2);
    expect(disconnected).toHaveBeenCalledTimes(2);
  });

  it("can create a new context while a previous context is closing", async () => {
    let finishClose: (() => void) | undefined;
    const closePromise = new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    const firstContext = {
      state: "running" as AudioContextState,
      close: vi.fn(() => closePromise),
    };
    const secondContext = {
      state: "running" as AudioContextState,
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
