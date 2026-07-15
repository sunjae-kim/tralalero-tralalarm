const HOUR_MS = 60 * 60 * 1_000;

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

export class AudioAlarmScheduler {
  private readonly createAudioContext: () => AudioContext;
  private readonly fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly now: () => number;
  private readonly buffers = new Map<string, AudioBuffer>();
  private context: AudioContext | null = null;
  private scheduledSources: AudioBufferSourceNode[] = [];

  constructor({
    createAudioContext = () => new AudioContext(),
    fetchArrayBuffer = defaultFetchArrayBuffer,
    now = Date.now,
  }: AudioAlarmSchedulerDependencies = {}) {
    this.createAudioContext = createAudioContext;
    this.fetchArrayBuffer = fetchArrayBuffer;
    this.now = now;
  }

  get isReady(): boolean {
    return this.context?.state === "running";
  }

  async enable(): Promise<void> {
    if (!this.context || this.context.state === "closed") {
      this.context = this.createAudioContext();
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }

    if (this.context.state !== "running") {
      throw new Error("The browser did not enable alarm audio.");
    }
  }

  async scheduleHourly(
    soundUrl: string,
    firstAlarmAt: number,
    occurrenceCount = 24
  ): Promise<void> {
    if (!this.context || this.context.state !== "running") {
      throw new Error("Enable alarm audio before scheduling it.");
    }

    const buffer = await this.loadBuffer(soundUrl);
    this.cancel();

    const now = this.now();
    const audioNow = this.context.currentTime;

    for (let index = 0; index < occurrenceCount; index += 1) {
      const alarmAt = firstAlarmAt + index * HOUR_MS;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.onended = () => {
        source.disconnect();
        this.scheduledSources = this.scheduledSources.filter(
          (scheduledSource) => scheduledSource !== source
        );
      };
      source.start(audioNow + Math.max(0, (alarmAt - now) / 1_000));
      this.scheduledSources.push(source);
    }
  }

  cancel(): void {
    for (const source of this.scheduledSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }
    this.scheduledSources = [];
  }

  async dispose(): Promise<void> {
    this.cancel();
    this.buffers.clear();

    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      await context.close();
    }
  }

  private async loadBuffer(soundUrl: string): Promise<AudioBuffer> {
    const cachedBuffer = this.buffers.get(soundUrl);
    if (cachedBuffer) {
      return cachedBuffer;
    }

    if (!this.context) {
      throw new Error("Audio context is unavailable.");
    }

    const soundData = await this.fetchArrayBuffer(soundUrl);
    const buffer = await this.context.decodeAudioData(soundData);
    this.buffers.set(soundUrl, buffer);
    return buffer;
  }
}
