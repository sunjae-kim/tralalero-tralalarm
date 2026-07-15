import { format } from "date-fns";

export type AlarmStatus =
  | "disabled"
  | "needs-interaction"
  | "arming"
  | "ready"
  | "error";

export const getAlarmStatusMessage = (
  status: AlarmStatus,
  nextAlarmTime: Date | null
): string => {
  switch (status) {
    case "ready":
      return nextAlarmTime
        ? `Alarm set for ${format(nextAlarmTime, "HH:mm")}`
        : "Alarm set";
    case "arming":
      return "Setting alarm...";
    case "needs-interaction":
      return "Tap anywhere to activate";
    case "error":
      return "Tap anywhere to try again";
    case "disabled":
      return "";
  }
};
