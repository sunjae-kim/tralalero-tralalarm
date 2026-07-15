import { getNextAlarmTime, parseStoredMinute } from "./alarmTime";

export type AlarmMinuteSlots = [number | null, number | null];

const parseMinuteValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return parseStoredMinute(String(value));
  }
  if (typeof value === "string") {
    return parseStoredMinute(value);
  }
  return null;
};

export const getActiveAlarmMinutes = (
  minuteSlots: AlarmMinuteSlots
): number[] => {
  const activeMinutes: number[] = [];
  for (const minute of minuteSlots) {
    if (minute !== null && !activeMinutes.includes(minute)) {
      activeMinutes.push(minute);
    }
  }
  return activeMinutes;
};

export const getNextAlarmOccurrence = (
  now: Date,
  minuteSlots: AlarmMinuteSlots
): Date | null => {
  const occurrences = getActiveAlarmMinutes(minuteSlots).map((minute) =>
    getNextAlarmTime(now, minute)
  );

  if (occurrences.length === 0) {
    return null;
  }

  return new Date(
    Math.min(...occurrences.map((occurrence) => occurrence.getTime()))
  );
};

export const parseStoredAlarmMinutes = (
  storedMinutes: string | null,
  legacyMinute: string | null
): AlarmMinuteSlots => {
  if (storedMinutes !== null) {
    try {
      const parsed = JSON.parse(storedMinutes) as unknown;
      if (Array.isArray(parsed)) {
        const first = parseMinuteValue(parsed[0]);
        const parsedSecond = parseMinuteValue(parsed[1]);
        const second = parsedSecond === first ? null : parsedSecond;
        return [first, second];
      }
    } catch {
      // Fall through to the previous single-minute value.
    }
  }

  return [parseStoredMinute(legacyMinute), null];
};
