import { describe, expect, it } from "vitest";
import {
  getActiveAlarmMinutes,
  getNextAlarmOccurrence,
  parseStoredAlarmMinutes,
} from "./alarmMinutes";

describe("getActiveAlarmMinutes", () => {
  it("keeps two distinct minutes and removes duplicate selections", () => {
    expect(getActiveAlarmMinutes([50, 0])).toEqual([50, 0]);
    expect(getActiveAlarmMinutes([50, 50])).toEqual([50]);
    expect(getActiveAlarmMinutes([null, 0])).toEqual([0]);
  });
});

describe("getNextAlarmOccurrence", () => {
  it("chooses the earliest upcoming occurrence across both minute slots", () => {
    const beforeFifty = new Date(2026, 6, 15, 12, 45, 20, 0);
    const afterFifty = new Date(2026, 6, 15, 12, 55, 20, 0);

    expect(getNextAlarmOccurrence(beforeFifty, [50, 0])).toEqual(
      new Date(2026, 6, 15, 12, 50, 0, 0)
    );
    expect(getNextAlarmOccurrence(afterFifty, [50, 0])).toEqual(
      new Date(2026, 6, 15, 13, 0, 0, 0)
    );
  });

  it("returns null when neither slot is selected", () => {
    expect(getNextAlarmOccurrence(new Date(), [null, null])).toBeNull();
  });
});

describe("parseStoredAlarmMinutes", () => {
  it("restores two valid persisted minute slots", () => {
    expect(parseStoredAlarmMinutes("[50,0]", null)).toEqual([50, 0]);
  });

  it("migrates the previous single-minute storage value", () => {
    expect(parseStoredAlarmMinutes(null, "50")).toEqual([50, null]);
  });

  it("rejects malformed, out-of-range, and duplicate values safely", () => {
    expect(parseStoredAlarmMinutes("[60,-1]", null)).toEqual([null, null]);
    expect(parseStoredAlarmMinutes("[50,50]", null)).toEqual([50, null]);
    expect(parseStoredAlarmMinutes("not-json", "0")).toEqual([0, null]);
  });
});
