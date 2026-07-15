import { format } from "date-fns";
import {
  AlarmMinuteSlots,
  parseStoredAlarmMinutes,
} from "./alarmMinutes";
import { SOUND_OPTIONS, STORAGE_KEYS } from "./constants";

// localStorage helper functions
export const getStoredMinutes = (): AlarmMinuteSlots => {
  try {
    return parseStoredAlarmMinutes(
      localStorage.getItem(STORAGE_KEYS.SELECTED_MINUTES),
      localStorage.getItem(STORAGE_KEYS.SELECTED_MINUTE)
    );
  } catch {
    return [null, null];
  }
};

export const getStoredSound = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_SOUND);
    return stored && SOUND_OPTIONS.find((option) => option.id === stored)
      ? stored
      : SOUND_OPTIONS[0].id;
  } catch {
    return SOUND_OPTIONS[0].id;
  }
};

export const saveMinutesToStorage = (minutes: AlarmMinuteSlots): void => {
  try {
    if (minutes.some((minute) => minute !== null)) {
      localStorage.setItem(
        STORAGE_KEYS.SELECTED_MINUTES,
        JSON.stringify(minutes)
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_MINUTES);
    }
    localStorage.removeItem(STORAGE_KEYS.SELECTED_MINUTE);
  } catch (error) {
    console.warn("Failed to save selected minutes to localStorage:", error);
  }
};

export const saveSoundToStorage = (soundId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_SOUND, soundId);
  } catch (error) {
    console.warn("Failed to save selected sound to localStorage:", error);
  }
};

// Notification helper functions
export const createNotification = (
  title: string,
  body: string,
  tag: string,
  requireInteraction = false
): Notification | null => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  try {
    const notificationOptions = {
      body,
      icon: "/favicon.ico",
      tag,
      requireInteraction,
      silent: false,
      renotify: true,
      timestamp: Date.now(),
    };

    return new Notification(title, notificationOptions);
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
};

export const createPreviewNotification = (): Notification | null => {
  console.log("Notification permission:", Notification.permission);
  console.log("Document visibility:", document.visibilityState);
  console.log("Document focused:", document.hasFocus());

  return createNotification(
    "🔔 Tralalero Tralalarm - Preview",
    "This is how the notification will appear!",
    "tralalarm-preview-" + Date.now(),
    false
  );
};

export const createAlarmNotification = (
  currentTime: Date
): Notification | null => {
  return createNotification(
    "🚨 Tralalero Tralalarm",
    `Alarm time! It's ${format(currentTime, "HH:mm")}`,
    "tralalarm-alarm-" + Date.now(),
    true
  );
};

export const requestNotificationPermission = async (): Promise<void> => {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications.");
    return;
  }

  if (Notification.permission === "default") {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        createPreviewNotification();
      } else {
        alert(
          "Notification permission was denied. Please allow notifications in your browser settings."
        );
      }
    } catch (error) {
      console.error("Permission request failed:", error);
      alert("Failed to request notification permission.");
    }
  } else if (Notification.permission === "denied") {
    alert("Notifications are blocked. Please allow notifications in your browser settings.");
  }
};
