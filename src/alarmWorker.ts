import {
  AlarmWorkerCommand,
  AlarmWorkerController,
  AlarmWorkerWakeMessage,
} from "./alarmWorkerController";

interface AlarmWorkerScope {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timerId: number) => void;
  postMessage: (message: AlarmWorkerWakeMessage) => void;
  onmessage: ((event: MessageEvent<AlarmWorkerCommand>) => void) | null;
}

const workerScope = self as unknown as AlarmWorkerScope;
const controller = new AlarmWorkerController({
  now: Date.now,
  setTimer: (callback, delay) => workerScope.setTimeout(callback, delay),
  clearTimer: (timerId) => workerScope.clearTimeout(timerId),
  postWake: (alarmAt, now) => {
    workerScope.postMessage({ type: "wake", alarmAt, now });
  },
});

workerScope.onmessage = (event) => {
  const message = event.data;
  if (message.type === "schedule") {
    controller.schedule(message.alarmAt);
  } else if (message.type === "cancel") {
    controller.cancel();
  }
};
