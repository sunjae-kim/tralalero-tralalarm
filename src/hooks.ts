import { useCallback, useEffect, useRef, useState } from "react";
import {
  didCrossAlarmTime,
  getNextAlarmTime,
  parseStoredMinute,
} from "./alarmTime";
import { AudioAlarmScheduler } from "./audioAlarmScheduler";
import { AlarmStatus } from "./alarmStatus";
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
  const hasUserEnabledAlarmRef = useRef(false);
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

      const nextAlarm = setNextAlarm(new Date(), minute);

      if (!scheduler || !selectedOption) {
        setAlarmStatus("error");
        return Promise.resolve();
      }

      scheduler.cancel();
      setAlarmStatus("arming");

      // Attach both resolve and reject handlers immediately so permission/audio
      // failures cannot become temporarily unhandled while prior arm work drains.
      const activationResultPromise = (
        selectedOption.isNotification
          ? requestNotificationPermission()
          : scheduler.enable()
      ).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error })
      );

      const operation = armQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const activationResult = await activationResultPromise;
            if (!activationResult.ok) {
              throw activationResult.error;
            }
            if (version !== armVersionRef.current) {
              return;
            }

            if (selectedOption.isNotification) {
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                hasUserEnabledAlarmRef.current = true;
                setAlarmStatus("ready");
              } else {
                setAlarmStatus("error");
              }
              return;
            }

            const scheduledAlarmTimes = await scheduler.scheduleHourly(
              selectedOption.file,
              nextAlarm.getTime(),
              AUDIO_SCHEDULE_OCCURRENCES
            );

            if (version !== armVersionRef.current) {
              scheduler.cancel();
              return;
            }

            const firstScheduledAlarm = scheduledAlarmTimes[0];
            if (firstScheduledAlarm === undefined) {
              throw new Error("No alarm occurrence was scheduled.");
            }

            nextAlarmAtRef.current = firstScheduledAlarm;
            setNextAlarmTime(new Date(firstScheduledAlarm));
            hasUserEnabledAlarmRef.current = true;
            setAlarmStatus("ready");
          } catch (error) {
            if (version !== armVersionRef.current) {
              return;
            }
            console.warn("Failed to arm alarm:", error);
            setAlarmStatus("error");
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
      const scheduler = schedulerRef.current;
      const wasScheduledByAudioClock =
        scheduler?.state === "running" && scheduler.isScheduled(alarmAt);

      if (selectedOption.isNotification) {
        const notification = createAlarmNotification(now);
        if (notification) {
          notification.onclick = () => {
            notification.close();
            window.focus();
          };
          showAlarmVisual();
        }
      } else if (wasScheduledByAudioClock) {
        // Only a source confirmed for this specific boundary may suppress the
        // fallback. A running AudioContext by itself does not prove playback.
        if (lateness < ALARM_VISUAL_DURATION_MS) {
          showAlarmVisual();
        }
      } else if (audioRef.current) {
        // Catch up after a tab resume or failed exact schedule. Report success
        // only after HTMLMediaElement.play() actually resolves.
        audioRef.current
          .play()
          .then(() => {
            showAlarmVisual();
          })
          .catch((error) => {
            console.warn("Failed to play alarm audio:", error);
            setAlarmStatus("error");
          });
      }

      const nextAlarm = setNextAlarm(now, minute);

      if (
        !selectedOption.isNotification &&
        scheduler &&
        hasUserEnabledAlarmRef.current
      ) {
        const refillVersion = armVersionRef.current;
        const refillOperation = armQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (refillVersion !== armVersionRef.current) {
              return;
            }

            try {
              const scheduledAlarmTimes = await scheduler.ensureHourlySchedule(
                selectedOption.file,
                nextAlarm.getTime(),
                AUDIO_SCHEDULE_OCCURRENCES
              );
              if (refillVersion !== armVersionRef.current) {
                return;
              }

              const firstScheduledAlarm = scheduledAlarmTimes[0];
              if (
                firstScheduledAlarm !== undefined &&
                !scheduler.isScheduled(nextAlarm.getTime())
              ) {
                nextAlarmAtRef.current = firstScheduledAlarm;
                setNextAlarmTime(new Date(firstScheduledAlarm));
              }
            } catch (error) {
              if (refillVersion !== armVersionRef.current) {
                return;
              }
              console.warn("Failed to refill alarm schedule:", error);
              setAlarmStatus("needs-interaction");
            }
          });
        armQueueRef.current = refillOperation;
      }
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
    const needsActivation =
      selectedMinute !== null &&
      (alarmStatus === "needs-interaction" || alarmStatus === "error");

    if (!needsActivation) {
      return;
    }

    let handled = false;
    const activateFromFirstGesture = () => {
      if (handled || selectedMinuteRef.current === null) {
        return;
      }
      handled = true;
      void armAlarm(selectedMinuteRef.current, selectedSoundRef.current);
    };

    document.addEventListener("pointerdown", activateFromFirstGesture, true);
    document.addEventListener("keydown", activateFromFirstGesture, true);
    return () => {
      document.removeEventListener("pointerdown", activateFromFirstGesture, true);
      document.removeEventListener("keydown", activateFromFirstGesture, true);
    };
  }, [alarmStatus, armAlarm, selectedMinute]);

  useEffect(() => {
    const handleResume = () => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarm(now);

      const minute = selectedMinuteRef.current;
      const soundId = selectedSoundRef.current;
      const selectedOption = SOUND_OPTIONS.find(
        (option) => option.id === soundId
      );
      if (
        document.visibilityState === "visible" &&
        minute !== null &&
        selectedOption &&
        !selectedOption.isNotification &&
        hasUserEnabledAlarmRef.current
      ) {
        // A previously enabled context may have been suspended/closed while the
        // page was hidden. Retry it on resume; failure exposes the tap hint.
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

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) {
      return;
    }

    const unsubscribe = scheduler.onStateChange((state) => {
      const minute = selectedMinuteRef.current;
      const selectedOption = SOUND_OPTIONS.find(
        (option) => option.id === selectedSoundRef.current
      );

      if (
        state !== "running" &&
        minute !== null &&
        selectedOption &&
        !selectedOption.isNotification &&
        hasUserEnabledAlarmRef.current
      ) {
        setAlarmStatus("needs-interaction");
      }
    });

    return () => {
      unsubscribe();
      armVersionRef.current += 1;
      if (visualTimerRef.current) {
        clearTimeout(visualTimerRef.current);
      }
      void scheduler.dispose();
    };
  }, []);

  const handleMinuteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const minute = parseStoredMinute(event.target.value);
    setSelectedMinute(minute);
    selectedMinuteRef.current = minute;

    if (minute === null) {
      armVersionRef.current += 1;
      hasUserEnabledAlarmRef.current = false;
      schedulerRef.current?.cancel();
      nextAlarmAtRef.current = null;
      setNextAlarmTime(null);
      setAlarmStatus("disabled");
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
    nextAlarmTime,
    audioRef,
    previewAudioRef,
    handleMinuteChange,
    handleSoundChange,
    previewSound,
  };
};
