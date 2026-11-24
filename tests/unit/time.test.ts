import { describe, expect, it } from "vitest";
import { addDays, addMonths, careDateOf, clockOf, daysInMonth, formatClock, formatDuration, fromLocal, isCareDate, isClockTime, minutesBetween, TIME_ZONE, weekdayOf } from "../../src/lib/care/time";

describe("Kuala Lumpur time", () => {
  it("maps KL wall-clock times to UTC instants", () => {
    expect(fromLocal("2026-11-24", "08:12")).toBe("2026-11-24T00:12:00.000Z");
    expect(fromLocal("2026-11-24", "00:30")).toBe("2026-11-23T16:30:00.000Z");
  });

  it("gives the KL date and clock of an instant, whatever the phone's timezone", () => {
    // 23 Nov 16:30 UTC is already 24 Nov 00:30 in KL.
    expect(careDateOf("2026-11-23T16:30:00.000Z")).toBe("2026-11-24");
    expect(clockOf("2026-11-23T16:30:00.000Z")).toBe("00:30");
    expect(careDateOf("2026-11-23T15:59:59.000Z")).toBe("2026-11-23");
  });

  it("agrees with the platform's own Asia/Kuala_Lumpur rules across the year", () => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    for (let i = 0; i < 365; i += 7) {
      const d = new Date(Date.UTC(2026, 0, 1, 13, 7) + i * 86_400_000);
      const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
      expect(careDateOf(d)).toBe(`${parts.year}-${parts.month}-${parts.day}`);
      expect(clockOf(d)).toBe(`${parts.hour}:${parts.minute}`);
    }
  });

  it("knows weekdays, month lengths and leap years", () => {
    expect(weekdayOf("2026-11-24")).toBe(2); // Tuesday
    expect(weekdayOf("2026-11-29")).toBe(0); // Sunday
    expect(daysInMonth("2026-02")).toHaveLength(28);
    expect(daysInMonth("2028-02")).toHaveLength(29);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("validates dates and clock times", () => {
    expect(isCareDate("2026-11-24")).toBe(true);
    expect(isCareDate("2026-02-30")).toBe(false);
    expect(isCareDate("24/11/2026")).toBe(false);
    expect(isClockTime("08:00")).toBe(true);
    expect(isClockTime("24:00")).toBe(false);
    expect(isClockTime("8:00")).toBe(false);
  });

  it("formats durations and clock times for people", () => {
    expect(minutesBetween(fromLocal("2026-11-24", "08:12"), fromLocal("2026-11-24", "17:34"))).toBe(562);
    expect(formatDuration(562)).toBe("9h 22m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatClock(fromLocal("2026-11-24", "00:05"))).toBe("12:05 AM");
    expect(formatClock(fromLocal("2026-11-24", "12:30"))).toBe("12:30 PM");
    expect(formatClock(fromLocal("2026-11-24", "17:34"))).toBe("5:34 PM");
  });
});
