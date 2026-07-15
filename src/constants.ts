import { SoundOption } from "./types";

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: "tralalero",
    name: "Tralalero Tralala",
    file: "/sound/tralalero-tralala.mp3",
    isNotification: false,
  },
  {
    id: "brr-long",
    name: "Brr Brr Patapim (Long)",
    file: "/sound/brr-long.mp3",
    isNotification: false,
  },
  {
    id: "brr-short",
    name: "Brr Brr Patapim (Short)",
    file: "/sound/brr-short.mp3",
    isNotification: false,
  },
  {
    id: "bright-chime-short",
    name: "Bright Chime (Short)",
    file: "/sound/bright-chime-short.wav",
    isNotification: false,
  },
  {
    id: "double-beep-clear",
    name: "Double Beep (Clear)",
    file: "/sound/double-beep-clear.wav",
    isNotification: false,
  },
  {
    id: "triple-wake-beep",
    name: "Triple Wake Beep",
    file: "/sound/triple-wake-beep.wav",
    isNotification: false,
  },
  {
    id: "ascending-ping-alert",
    name: "Ascending Ping Alert",
    file: "/sound/ascending-ping-alert.wav",
    isNotification: false,
  },
  {
    id: "notification",
    name: "Browser Notification",
    file: "",
    isNotification: true,
  },
];

export const STORAGE_KEYS = {
  SELECTED_MINUTES: "tralalarm-selected-minutes",
  SELECTED_MINUTE: "tralalarm-selected-minute",
  SELECTED_SOUND: "tralalarm-selected-sound",
} as const;
