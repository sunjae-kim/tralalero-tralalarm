import { useEffect, useRef, useState } from "react";
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

export const useAlarmClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMinute, setSelectedMinute] = useState<number | null>(
    getStoredMinute()
  );
  const [selectedSound, setSelectedSound] = useState(getStoredSound());
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedMinute = useRef<number | null>(null);

  // Time update effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    saveMinuteToStorage(selectedMinute);
  }, [selectedMinute]);

  useEffect(() => {
    saveSoundToStorage(selectedSound);
  }, [selectedSound]);

  // Alarm logic
  useEffect(() => {
    const currentMinute = currentTime.getMinutes();

    if (
      selectedMinute !== null &&
      currentMinute === selectedMinute &&
      lastPlayedMinute.current !== currentMinute
    ) {
      const selectedOption = SOUND_OPTIONS.find(
        (option) => option.id === selectedSound
      );

      if (selectedOption?.isNotification) {
        // Send browser notification
        const notification = createAlarmNotification(currentTime);
        if (notification) {
          notification.onclick = () => {
            notification.close();
            window.focus();
          };
          console.log("Alarm notification sent");
        }
        setIsAlarmPlaying(true);
        lastPlayedMinute.current = currentMinute;
      } else if (audioRef.current) {
        // Play audio
        audioRef.current.play();
        setIsAlarmPlaying(true);
        lastPlayedMinute.current = currentMinute;
      }
    }

    if (
      lastPlayedMinute.current !== null &&
      lastPlayedMinute.current !== currentMinute
    ) {
      lastPlayedMinute.current = null;
      setIsAlarmPlaying(false);
    }
  }, [currentTime, selectedMinute, selectedSound]);

  // Audio ended event
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

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setSelectedMinute(isNaN(value) ? null : value);
  };

  const handleSoundChange = (soundId: string) => {
    setSelectedSound(soundId);
  };

  const previewSound = (option: (typeof SOUND_OPTIONS)[0]) => {
    if (option.isNotification) {
      if (Notification.permission === "granted") {
        const notification = createPreviewNotification();
        if (notification) {
          notification.onshow = () =>
            console.log("Notification is now showing");
          notification.onclick = () => {
            console.log("Notification was clicked");
            notification.close();
            window.focus();
          };
          notification.onclose = () => console.log("Notification was closed");
          notification.onerror = (error) => {
            console.error("Notification error:", error);
            alert("An error occurred while displaying the notification.");
          };
          console.log("Notification sent successfully");
        } else {
          alert("Failed to create notification. Please check your browser settings.");
        }
      } else {
        requestNotificationPermission();
      }
    } else {
      // Preview audio
      if (previewAudioRef.current) {
        previewAudioRef.current.src = option.file;
        previewAudioRef.current.play().catch((error) => {
          console.warn("Failed to play preview audio:", error);
        });
      }
    }
  };

  return {
    currentTime,
    selectedMinute,
    selectedSound,
    isAlarmPlaying,
    audioRef,
    previewAudioRef,
    handleMinuteChange,
    handleSoundChange,
    previewSound,
  };
};
