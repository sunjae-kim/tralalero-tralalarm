import { describe, expect, it } from "vitest";
import {
  didCrossAlarmTime,
  getNextAlarmTime,
  parseStoredMinute,
} from "./alarmTime";

describe("getNextAlarmTime", () => {
  it("schedules the selected minute at exactly second zero", () => {
    const now = new Date(2026, 6, 15, 10, 59, 30, 250);

    const nextAlarm = getNextAlarmTime(now, 0);

    expect(nextAlarm.getHours()).toBe(11);
    expect(nextAlarm.getMinutes()).toBe(0);
    expect(nextAlarm.getSeconds()).toBe(0);
    expect(nextAlarm.getMilliseconds()).toBe(0);
  });

  it("uses the next hour when the selected minute already started", () => {
    const now = new Date(2026, 6, 15, 10, 0, 20, 0);

    const nextAlarm = getNextAlarmTime(now, 0);

    expect(nextAlarm.getHours()).toBe(11);
    expect(nextAlarm.getMinutes()).toBe(0);
  });
});

describe("parseStoredMinute", () => {
  it("accepts persisted integer minutes including zero", () => {
    expect(parseStoredMinute("0")).toBe(0);
    expect(parseStoredMinute("59")).toBe(59);
  });

  it("rejects malformed and out-of-range persisted values", () => {
    expect(parseStoredMinute(null)).toBeNull();
    expect(parseStoredMinute("")).toBeNull();
    expect(parseStoredMinute("3.5")).toBeNull();
    expect(parseStoredMinute("abc")).toBeNull();
    expect(parseStoredMinute("-1")).toBeNull();
    expect(parseStoredMinute("60")).toBeNull();
  });
});

describe("didCrossAlarmTime", () => {
  it("detects an alarm boundary even when a background callback arrives late", () => {
    const alarmAt = new Date(2026, 6, 15, 11, 0, 0, 0).getTime();
    const previousCheck = new Date(2026, 6, 15, 10, 59, 59, 0).getTime();
    const delayedCheck = new Date(2026, 6, 15, 11, 0, 37, 0).getTime();

    expect(didCrossAlarmTime(previousCheck, delayedCheck, alarmAt)).toBe(true);
  });

  it("does not fire before the target or more than once after it", () => {
    const alarmAt = new Date(2026, 6, 15, 11, 0, 0, 0).getTime();

    expect(didCrossAlarmTime(alarmAt - 2_000, alarmAt - 1_000, alarmAt)).toBe(false);
    expect(didCrossAlarmTime(alarmAt, alarmAt + 1_000, alarmAt)).toBe(false);
  });
});
