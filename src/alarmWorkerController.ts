export type AlarmWorkerCommand =
  | { type: "schedule"; alarmAt: number }
  | { type: "cancel" };

export interface AlarmWorkerWakeMessage {
  type: "wake";
  alarmAt: number;
  now: number;
}

interface AlarmWorkerControllerDependencies {
  now: () => number;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (timerId: number) => void;
  postWake: (alarmAt: number, now: number) => void;
}

export class AlarmWorkerController {
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delay: number) => number;
  private readonly clearTimer: (timerId: number) => void;
  private readonly postWake: (alarmAt: number, now: number) => void;
  private timerId: number | null = null;
  private alarmAt: number | null = null;

  constructor({
    now,
    setTimer,
    clearTimer,
    postWake,
  }: AlarmWorkerControllerDependencies) {
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.postWake = postWake;
  }

  schedule(alarmAt: number): void {
    this.cancel();
    this.alarmAt = alarmAt;
    this.scheduleCurrentAlarm();
  }

  cancel(): void {
    if (this.timerId !== null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }
    this.alarmAt = null;
  }

  private scheduleCurrentAlarm(): void {
    const alarmAt = this.alarmAt;
    if (alarmAt === null) {
      return;
    }

    const delay = Math.max(0, alarmAt - this.now());
    this.timerId = this.setTimer(() => {
      this.timerId = null;
      const currentAlarmAt = this.alarmAt;
      if (currentAlarmAt === null) {
        return;
      }

      const now = this.now();
      if (now < currentAlarmAt) {
        this.scheduleCurrentAlarm();
        return;
      }

      this.alarmAt = null;
      this.postWake(currentAlarmAt, now);
    }, delay);
  }
}
