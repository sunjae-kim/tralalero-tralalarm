const MINUTE_MIN = 0;
const MINUTE_MAX = 59;

const assertValidMinute = (minute: number) => {
  if (!Number.isInteger(minute) || minute < MINUTE_MIN || minute > MINUTE_MAX) {
    throw new RangeError("Alarm minute must be an integer from 0 through 59.");
  }
};

export const getNextAlarmTime = (now: Date, selectedMinute: number): Date => {
  assertValidMinute(selectedMinute);

  const nextAlarm = new Date(now);
  nextAlarm.setMinutes(selectedMinute, 0, 0);

  if (nextAlarm.getTime() <= now.getTime()) {
    nextAlarm.setHours(nextAlarm.getHours() + 1);
  }

  return nextAlarm;
};

export const didCrossAlarmTime = (
  previousCheckAt: number,
  currentCheckAt: number,
  alarmAt: number
): boolean => previousCheckAt < alarmAt && currentCheckAt >= alarmAt;
