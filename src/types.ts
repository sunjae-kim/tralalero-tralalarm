export interface SoundOption {
  id: string;
  name: string;
  file: string;
  isNotification: boolean;
}

export type NotificationPermission = "default" | "denied" | "granted";
