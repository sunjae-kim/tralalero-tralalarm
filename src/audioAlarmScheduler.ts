const HOUR_MS = 60 * 60 * 1_000;

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
  private scheduledSources = new Map<number, AudioBufferSourceNode>();
  private scheduledAlarmTimes = new Set<number>();

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
      this.context.onstatechange = () => this.notifyStateChange();
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }

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
    const buffer = await this.loadBuffer(soundUrl, context);
    this.assertSameRunningContext(context);

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
    const buffer = await this.loadBuffer(soundUrl, context);
    this.assertSameRunningContext(context);

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
    for (const source of this.scheduledSources.values()) {
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
    this.scheduledSoundUrl = null;
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

  private assertSameRunningContext(context: AudioContext): void {
    if (this.context !== context || context.state !== "running") {
      throw new Error("Alarm audio was interrupted while loading.");
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

    for (const alarmAt of alarmTimes) {
      if (this.scheduledSources.has(alarmAt)) {
        continue;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (this.scheduledSources.get(alarmAt) === source) {
          this.scheduledSources.delete(alarmAt);
        }
      };
      source.start(audioNow + (alarmAt - now) / 1_000);
      this.scheduledSources.set(alarmAt, source);
      this.scheduledAlarmTimes.add(alarmAt);
    }
  }

  private notifyStateChange(): void {
    const state = this.state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}
