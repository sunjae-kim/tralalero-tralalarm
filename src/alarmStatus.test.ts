import { describe, expect, it } from "vitest";
import { getAlarmStatusMessage } from "./alarmStatus";

describe("getAlarmStatusMessage", () => {
  it("uses one concise ready message without repeating the selected minute", () => {
    const nextAlarm = new Date(2026, 6, 15, 12, 50, 0, 0);

    expect(getAlarmStatusMessage("ready", nextAlarm)).toBe(
      "Alarm set for 12:50"
    );
  });

  it("replaces the dedicated enable button with a first-interaction hint", () => {
    expect(getAlarmStatusMessage("needs-interaction", null)).toBe(
      "Tap anywhere to activate"
    );
    expect(getAlarmStatusMessage("error", null)).toBe(
      "Tap anywhere to try again"
    );
  });

  it("keeps disabled and transitional states minimal", () => {
    expect(getAlarmStatusMessage("disabled", null)).toBe("");
    expect(getAlarmStatusMessage("arming", null)).toBe("Setting alarm...");
  });
});
