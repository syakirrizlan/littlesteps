/**
 * Kuala Lumpur time helpers. Malaysia is UTC+8 all year (no daylight saving since 1982),
 * so a KL wall-clock time maps to exactly one instant. Everything here works the same
 * whatever timezone the phone itself is set to.
 */
import type { CareDate, ClockTime, Instant } from "./types";

export const TIME_ZONE = "Asia/Kuala_Lumpur";
const OFFSET = "+08:00";
const OFFSET_MS = 8 * 60 * 60_000;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isCareDate = (s: unknown): s is CareDate => typeof s === "string" && DATE_RE.test(s) && careDateOf(fromLocal(s, "12:00")) === s;
export const isClockTime = (s: unknown): s is ClockTime => typeof s === "string" && CLOCK_RE.test(s);
export const isInstant = (s: unknown): s is Instant => typeof s === "string" && !Number.isNaN(Date.parse(s)) && /T.*(Z|[+-]\d\d:\d\d)$/.test(s);

/** The KL calendar date of an instant. */
export function careDateOf(at: Instant | Date): CareDate {
  const d = new Date(new Date(at).getTime() + OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/** The KL clock time of an instant, "HH:mm". */
export function clockOf(at: Instant | Date): ClockTime {
  const d = new Date(new Date(at).getTime() + OFFSET_MS);
  return d.toISOString().slice(11, 16);
}

/** The instant of a KL date and clock time. */
export function fromLocal(date: CareDate, time: ClockTime): Instant {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

/** Day of week of a KL date (0 = Sunday). */
export function weekdayOf(date: CareDate): number {
  return new Date(`${date}T12:00:00${OFFSET}`).getUTCDay();
}

export function addDays(date: CareDate, n: number): CareDate {
  const d = new Date(`${date}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return careDateOf(d);
}

export const monthOf = (date: CareDate) => date.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): CareDate[] {
  const out: CareDate[] = [];
  for (let d = `${month}-01`; monthOf(d) === month; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Whole minutes between two instants (never negative). */
export function minutesBetween(from: Instant, to: Instant): number {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 60_000));
}

/** Minutes past midnight of a clock time. */
export const clockMinutes = (t: ClockTime) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** "9h 22m", "45m", "0m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** "8:12 AM" in KL time. */
export function formatClock(at: Instant | Date): string {
  const [h, m] = clockOf(at).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const formatClockTime = (t: ClockTime) => formatClock(fromLocal("2026-01-01", t));

/** "Tue, 24 Nov 2026". */
export function formatDate(date: CareDate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { weekday = true, year = true } = opts;
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TIME_ZONE,
    weekday: weekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
  }).format(new Date(fromLocal(date, "12:00")));
}

/** "November 2026". */
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(new Date(fromLocal(`${month}-15`, "12:00")));
}
