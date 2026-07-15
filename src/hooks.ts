import { useCallback, useEffect, useRef, useState } from "react";
import { getNextAlarmTime, didCrossAlarmTime } from "./alarmTime";
import { AudioAlarmScheduler } from "./audioAlarmScheduler";
import { SOUND_OPTIONS } from "./constants";
import {
  createAlarmNotification,
  createPreviewNotification,
  getStoredMinute,
  getStoredSound,
  requestNotificationPermission,
  saveMinuteToStorage,
  saveSoundToStorage,
} from "./utils";

export type AlarmStatus =
  | "disabled"
  | "needs-interaction"
  | "arming"
  | "ready"
  | "error";

const AUDIO_SCHEDULE_OCCURRENCES = 48;
const ALARM_VISUAL_DURATION_MS = 5_000;

export const useAlarmClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMinute, setSelectedMinute] = useState<number | null>(
    getStoredMinute()
  );
  const [selectedSound, setSelectedSound] = useState(getStoredSound());
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [alarmStatus, setAlarmStatus] = useState<AlarmStatus>(
    selectedMinute === null ? "disabled" : "needs-interaction"
  );
  const [alarmError, setAlarmError] = useState<string | null>(null);
  const [nextAlarmTime, setNextAlarmTime] = useState<Date | null>(() =>
    selectedMinute === null ? null : getNextAlarmTime(new Date(), selectedMinute)
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const schedulerRef = useRef<AudioAlarmScheduler | null>(null);
  const selectedMinuteRef = useRef(selectedMinute);
  const selectedSoundRef = useRef(selectedSound);
  const nextAlarmAtRef = useRef<number | null>(
    nextAlarmTime?.getTime() ?? null
  );
  const previousCheckAtRef = useRef(Date.now());
  const armVersionRef = useRef(0);
  const armQueueRef = useRef<Promise<void>>(Promise.resolve());
  const visualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!schedulerRef.current) {
    schedulerRef.current = new AudioAlarmScheduler();
  }

  const showAlarmVisual = useCallback(() => {
    if (visualTimerRef.current) {
      clearTimeout(visualTimerRef.current);
    }
    setIsAlarmPlaying(true);
    visualTimerRef.current = setTimeout(() => {
      setIsAlarmPlaying(false);
      visualTimerRef.current = null;
    }, ALARM_VISUAL_DURATION_MS);
  }, []);

  const setNextAlarm = useCallback((now: Date, minute: number) => {
    const nextAlarm = getNextAlarmTime(now, minute);
    nextAlarmAtRef.current = nextAlarm.getTime();
    setNextAlarmTime(nextAlarm);
    return nextAlarm;
  }, []);

  const armAlarm = useCallback(
    (minute: number, soundId: string): Promise<void> => {
      const version = ++armVersionRef.current;
      const scheduler = schedulerRef.current;
      const selectedOption = SOUND_OPTIONS.find(
        (option) => option.id === soundId
      );

      setAlarmError(null);
      const nextAlarm = setNextAlarm(new Date(), minute);

      if (!scheduler || !selectedOption) {
        setAlarmStatus("error");
        setAlarmError("The selected alarm sound is unavailable.");
        return Promise.resolve();
      }

      scheduler.cancel();
      setAlarmStatus("arming");

      // Start permission-sensitive work immediately while this function is still
      // running inside the user's click/change gesture.
      const activationPromise = selectedOption.isNotification
        ? requestNotificationPermission()
        : scheduler.enable();

      const operation = armQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await activationPromise;
            if (version !== armVersionRef.current) {
              return;
            }

            if (selectedOption.isNotification) {
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                setAlarmStatus("ready");
              } else {
                setAlarmStatus("error");
                setAlarmError(
                  "Allow browser notifications, then enable the alarm again."
                );
              }
              return;
            }

            await scheduler.scheduleHourly(
              selectedOption.file,
              nextAlarm.getTime(),
              AUDIO_SCHEDULE_OCCURRENCES
            );

            if (version !== armVersionRef.current) {
              scheduler.cancel();
              return;
            }

            setAlarmStatus("ready");
          } catch (error) {
            if (version !== armVersionRef.current) {
              return;
            }
            console.warn("Failed to arm alarm:", error);
            setAlarmStatus("error");
            setAlarmError(
              "The browser blocked alarm audio. Click Enable Alarm and try again."
            );
          }
        });

      armQueueRef.current = operation;
      return operation;
    },
    [setNextAlarm]
  );

  const handleAlarmBoundary = useCallback(
    (now: Date, alarmAt: number) => {
      const minute = selectedMinuteRef.current;
      const soundId = selectedSoundRef.current;
      const selectedOption = SOUND_OPTIONS.find(
        (option) => option.id === soundId
      );

      if (minute === null || !selectedOption) {
        return;
      }

      const lateness = now.getTime() - alarmAt;

      if (selectedOption.isNotification) {
        const notification = createAlarmNotification(now);
        if (notification) {
          notification.onclick = () => {
            notification.close();
            window.focus();
          };
          showAlarmVisual();
        }
      } else if (schedulerRef.current?.isReady) {
        // Web Audio was scheduled against the hardware audio clock in advance.
        // The timer only drives the visual state and the next-alarm label.
        if (lateness < ALARM_VISUAL_DURATION_MS) {
          showAlarmVisual();
        }
      } else if (audioRef.current) {
        // Catch up after a tab resume if Web Audio was suspended or discarded.
        audioRef.current
          .play()
          .then(() => {
            showAlarmVisual();
          })
          .catch((error) => {
            console.warn("Failed to play alarm audio:", error);
            setAlarmStatus("error");
            setAlarmError(
              "The browser blocked alarm audio. Click Enable Alarm and try again."
            );
          });
      }

      setNextAlarm(now, minute);
    },
    [setNextAlarm, showAlarmVisual]
  );

  const checkAlarm = useCallback(
    (now: Date) => {
      const nowMs = now.getTime();
      const alarmAt = nextAlarmAtRef.current;

      if (
        alarmAt !== null &&
        didCrossAlarmTime(previousCheckAtRef.current, nowMs, alarmAt)
      ) {
        handleAlarmBoundary(now, alarmAt);
      }

      previousCheckAtRef.current = nowMs;
    },
    [handleAlarmBoundary]
  );

  // The UI clock can be throttled in background tabs. Exact audio playback does
  // not depend on this interval; it is pre-scheduled through Web Audio.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarm(now);
    };

    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [checkAlarm]);

  useEffect(() => {
    selectedMinuteRef.current = selectedMinute;
    saveMinuteToStorage(selectedMinute);
  }, [selectedMinute]);

  useEffect(() => {
    selectedSoundRef.current = selectedSound;
    saveSoundToStorage(selectedSound);
  }, [selectedSound]);

  useEffect(() => {
    const handleResume = () => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarm(now);

      const minute = selectedMinuteRef.current;
      const soundId = selectedSoundRef.current;
      if (
        document.visibilityState === "visible" &&
        minute !== null &&
        schedulerRef.current?.isReady
      ) {
        void armAlarm(minute, soundId);
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("pageshow", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("pageshow", handleResume);
    };
  }, [armAlarm, checkAlarm]);

  useEffect(() => {
    const currentAudio = audioRef.current;
    if (currentAudio) {
      currentAudio.onended = () => {
        setIsAlarmPlaying(false);
      };
    }

    return () => {
      if (currentAudio) {
        currentAudio.onended = null;
      }
    };
  }, []);

  useEffect(
    () => () => {
      armVersionRef.current += 1;
      if (visualTimerRef.current) {
        clearTimeout(visualTimerRef.current);
      }
      void schedulerRef.current?.dispose();
    },
    []
  );

  const handleMinuteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(event.target.value, 10);
    const minute = Number.isNaN(value) ? null : value;
    setSelectedMinute(minute);
    selectedMinuteRef.current = minute;

    if (minute === null) {
      armVersionRef.current += 1;
      schedulerRef.current?.cancel();
      nextAlarmAtRef.current = null;
      setNextAlarmTime(null);
      setAlarmStatus("disabled");
      setAlarmError(null);
      return;
    }

    void armAlarm(minute, selectedSoundRef.current);
  };

  const handleSoundChange = (soundId: string) => {
    setSelectedSound(soundId);
    selectedSoundRef.current = soundId;

    if (selectedMinuteRef.current !== null) {
      void armAlarm(selectedMinuteRef.current, soundId);
    }
  };

  const enableAlarm = () => {
    if (selectedMinuteRef.current !== null) {
      void armAlarm(selectedMinuteRef.current, selectedSoundRef.current);
    }
  };

  const previewSound = (option: (typeof SOUND_OPTIONS)[0]) => {
    if (option.isNotification) {
      if (Notification.permission === "granted") {
        const notification = createPreviewNotification();
        if (notification) {
          notification.onclick = () => {
            notification.close();
            window.focus();
          };
        }
      } else {
        void requestNotificationPermission();
      }
    } else if (previewAudioRef.current) {
      previewAudioRef.current.src = option.file;
      previewAudioRef.current.play().catch((error) => {
        console.warn("Failed to play preview audio:", error);
      });
    }
  };

  return {
    currentTime,
    selectedMinute,
    selectedSound,
    isAlarmPlaying,
    alarmStatus,
    alarmError,
    nextAlarmTime,
    audioRef,
    previewAudioRef,
    handleMinuteChange,
    handleSoundChange,
    enableAlarm,
    previewSound,
  };
};
