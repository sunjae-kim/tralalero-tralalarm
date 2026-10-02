const HOUR_MS = 60 * 60 * 1_000;
const CLOCK_DRIFT_TOLERANCE_MS = 250;

type SchedulerState = AudioContextState | "uninitialized";
type StateListener = (state: SchedulerState) => void;

interface AudioAlarmSchedulerDependencies {
  createAudioContext?: () => AudioContext;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  now?: () => number;
}

const defaultFetchArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load alarm sound (${response.status}).`);
  }
  return response.arrayBuffer();
};

const getFutureHourlyTimes = (
  firstAlarmAt: number,
  now: number,
  occurrenceCount: number
): number[] => {
  let firstFutureAlarm = firstAlarmAt;
  while (firstFutureAlarm <= now) {
    firstFutureAlarm += HOUR_MS;
  }

  return Array.from(
    { length: Math.max(0, occurrenceCount) },
    (_, index) => firstFutureAlarm + index * HOUR_MS
  );
};

export class AudioAlarmScheduler {
  private readonly createAudioContext: () => AudioContext;
  private readonly fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly now: () => number;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly stateListeners = new Set<StateListener>();
  private context: AudioContext | null = null;
  private scheduledSoundUrl: string | null = null;
  private scheduledSources = new Map<
    number,
    { source: AudioBufferSourceNode; audioStartAt: number }
  >();
  private scheduledAlarmTimes = new Set<number>();
  private pendingAlarmTimes = new Set<number>();
  private clockOffsetMs: number | null = null;
  private scheduleGeneration = 0;

  constructor({
    createAudioContext = () => new AudioContext(),
    fetchArrayBuffer = defaultFetchArrayBuffer,
    now = Date.now,
  }: AudioAlarmSchedulerDependencies = {}) {
    this.createAudioContext = createAudioContext;
    this.fetchArrayBuffer = fetchArrayBuffer;
    this.now = now;
  }

  get state(): SchedulerState {
    return this.context?.state ?? "uninitialized";
  }

  get isReady(): boolean {
    return this.state === "running";
  }

  isScheduled(alarmAt: number): boolean {
    return this.scheduledAlarmTimes.has(alarmAt);
  }

  reconcileClock(): void {
    const context = this.context;
    if (!context || this.pendingAlarmTimes.size === 0) {
      return;
    }
    if (context.state !== "running") {
      this.invalidateAudioClock();
      return;
    }

    const now = this.now();
    const offsetMs = now - context.currentTime * 1_000;
    if (
      this.clockOffsetMs !== null &&
      Math.abs(offsetMs - this.clockOffsetMs) <= CLOCK_DRIFT_TOLERANCE_MS
    ) {
      return;
    }

    this.invalidateAudioClock();
    const futureTimes = [...this.pendingAlarmTimes].filter((alarmAt) => {
      if (alarmAt <= now) {
        this.pendingAlarmTimes.delete(alarmAt);
        return false;
      }
      return true;
    });
    const buffer = this.scheduledSoundUrl
      ? this.buffers.get(this.scheduledSoundUrl)
      : undefined;
    if (buffer) {
      this.scheduleTimes(context, buffer, futureTimes, now);
    }
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  async enable(): Promise<void> {
    if (!this.context || this.context.state === "closed") {
      this.context = this.createAudioContext();
      const context = this.context;
      context.onstatechange = () => {
        if (this.context === context) {
          this.reconcileClock();
          this.notifyStateChange();
        }
      };
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }

    this.reconcileClock();
    this.notifyStateChange();
    if (this.context.state !== "running") {
      throw new Error("The browser did not enable alarm audio.");
    }
  }

  async scheduleHourly(
    soundUrl: string,
    firstAlarmAt: number,
    occurrenceCount = 24
  ): Promise<number[]> {
    const context = this.getRunningContext();
    const generation = this.scheduleGeneration;
    const buffer = await this.loadBuffer(soundUrl, context);
    this.assertSameRunningContext(context, generation);

    const now = this.now();
    const alarmTimes = getFutureHourlyTimes(
      firstAlarmAt,
      now,
      occurrenceCount
    );

    this.cancel();
    this.scheduledSoundUrl = soundUrl;
    this.scheduleTimes(context, buffer, alarmTimes, now);
    return alarmTimes;
  }

  async ensureHourlySchedule(
    soundUrl: string,
    firstAlarmAt: number,
    occurrenceCount = 24
  ): Promise<number[]> {
    const context = this.getRunningContext();
    const generation = this.scheduleGeneration;
    const buffer = await this.loadBuffer(soundUrl, context);
    this.assertSameRunningContext(context, generation);
    this.reconcileClock();

    const now = this.now();
    const alarmTimes = getFutureHourlyTimes(
      firstAlarmAt,
      now,
      occurrenceCount
    );

    if (this.scheduledSoundUrl !== soundUrl) {
      this.cancel();
      this.scheduledSoundUrl = soundUrl;
    }

    this.scheduleTimes(context, buffer, alarmTimes, now);
    return alarmTimes;
  }

  cancel(): void {
    this.scheduleGeneration += 1;
    for (const { source } of this.scheduledSources.values()) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }
    this.scheduledSources.clear();
    this.scheduledAlarmTimes.clear();
    this.pendingAlarmTimes.clear();
    this.clockOffsetMs = null;
    this.scheduledSoundUrl = null;
  }

  private invalidateAudioClock(): void {
    const audioNow = this.context?.currentTime ?? 0;
    for (const [alarmAt, { source, audioStartAt }] of this.scheduledSources) {
      // Preserve evidence of an already-started occurrence, but never let an
      // unstarted, stale source suppress recovery or play later a second time.
      if (audioStartAt <= audioNow) {
        this.pendingAlarmTimes.delete(alarmAt);
      } else {
        this.scheduledAlarmTimes.delete(alarmAt);
      }
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }
    this.scheduledSources.clear();
    this.clockOffsetMs = null;
  }

  async dispose(): Promise<void> {
    this.cancel();
    this.buffers.clear();

    const context = this.context;
    this.context = null;
    if (context) {
      context.onstatechange = null;
      if (context.state !== "closed") {
        await context.close();
      }
    }
    this.notifyStateChange();
  }

  private getRunningContext(): AudioContext {
    if (!this.context || this.context.state !== "running") {
      throw new Error("Enable alarm audio before scheduling it.");
    }
    return this.context;
  }

  private assertSameRunningContext(context: AudioContext, generation: number): void {
    if (this.context !== context || context.state !== "running") {
      throw new Error("Alarm audio was interrupted while loading.");
    }
    if (generation !== this.scheduleGeneration) {
      throw new Error("Alarm schedule was replaced while loading.");
    }
  }

  private async loadBuffer(
    soundUrl: string,
    context: AudioContext
  ): Promise<AudioBuffer> {
    const cachedBuffer = this.buffers.get(soundUrl);
    if (cachedBuffer) {
      return cachedBuffer;
    }

    const soundData = await this.fetchArrayBuffer(soundUrl);
    const buffer = await context.decodeAudioData(soundData);
    this.buffers.set(soundUrl, buffer);
    return buffer;
  }

  private scheduleTimes(
    context: AudioContext,
    buffer: AudioBuffer,
    alarmTimes: number[],
    now: number
  ): void {
    const audioNow = context.currentTime;
    this.clockOffsetMs ??= now - audioNow * 1_000;

    for (const alarmAt of alarmTimes) {
      if (this.scheduledSources.has(alarmAt)) {
        continue;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (this.scheduledSources.get(alarmAt)?.source === source) {
          this.scheduledSources.delete(alarmAt);
          this.pendingAlarmTimes.delete(alarmAt);
        }
      };
      const audioStartAt = audioNow + (alarmAt - now) / 1_000;
      source.start(audioStartAt);
      this.scheduledSources.set(alarmAt, { source, audioStartAt });
      this.scheduledAlarmTimes.add(alarmAt);
      this.pendingAlarmTimes.add(alarmAt);
    }
  }

  private notifyStateChange(): void {
    const state = this.state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}
