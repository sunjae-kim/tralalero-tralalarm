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
    id: "notification",
    name: "Browser Notification",
    file: "",
    isNotification: true,
  },
];

export const STORAGE_KEYS = {
  SELECTED_MINUTE: "tralalarm-selected-minute",
  SELECTED_SOUND: "tralalarm-selected-sound",
} as const;
