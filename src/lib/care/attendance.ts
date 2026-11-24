/**
 * Drop-off and pickup rules. Pure functions: they take the data and "now", and return
 * new data or a message explaining what to fix. Nothing here reads the clock or storage.
 */
import type { CareData, ClockTime, DaySchedule, Id, Instant, Result, Visit } from "./types";
import { careDateOf, clockMinutes, clockOf, formatClock, formatDate, minutesBetween, weekdayOf } from "./time";
import { fieldChanges, newId, withChanges } from "./history";

/** Times up to this far ahead of the phone's clock are accepted (clock drift, slow taps). */
const FUTURE_SLACK_MS = 2 * 60_000;
/** A visit can't be longer than this. */
export const MAX_VISIT_MINUTES = 24 * 60;
/** An open visit older than this needs a correction. */
const STALE_OPEN_MINUTES = 16 * 60;
export const MIN_REASON_LENGTH = 3;

const fail = (error: string): Result => ({ ok: false, error });
const isFuture = (at: Instant, now: Date) => Date.parse(at) > now.getTime() + FUTURE_SLACK_MS;

export const liveVisits = (data: CareData) => data.visits.filter((v) => !v.voided).sort((a, b) => a.droppedOffAt.localeCompare(b.droppedOffAt));
export const openVisit = (data: CareData) => liveVisits(data).find((v) => !v.pickedUpAt);
export const visitsOn = (data: CareData, date: string) => liveVisits(data).filter((v) => v.careDate === date);

export function scheduleFor(data: CareData, date: string): DaySchedule | undefined {
  const wd = weekdayOf(date);
  return data.schedule.find((s) => s.weekday === wd);
}

export function visitMinutes(v: Visit, now: Date): number {
  return minutesBetween(v.droppedOffAt, v.pickedUpAt ?? now.toISOString());
}

/** Late drop-off and early pickup, in minutes beyond the grace period's start. */
export function visitFlags(v: Visit, graceMinutes: number): { lateBy: number | null; earlyBy: number | null } {
  const diff = (a: ClockTime, b: ClockTime) => clockMinutes(a) - clockMinutes(b);
  let lateBy: number | null = null;
  let earlyBy: number | null = null;
  if (v.expected.dropOff) {
    const d = diff(clockOf(v.droppedOffAt), v.expected.dropOff);
    if (d > graceMinutes) lateBy = d;
  }
  if (v.expected.pickUp && v.pickedUpAt && careDateOf(v.pickedUpAt) === v.careDate) {
    const d = diff(v.expected.pickUp, clockOf(v.pickedUpAt));
    if (d > graceMinutes) earlyBy = d;
  }
  return { lateBy, earlyBy };
}

/** Why a visit needs a correction, or null. */
export function visitProblem(v: Visit, now: Date): string | null {
  if (v.voided || v.pickedUpAt) return null;
  if (v.careDate < careDateOf(now)) return `No pickup recorded for ${formatDate(v.careDate, { year: false })}.`;
  if (visitMinutes(v, now) > STALE_OPEN_MINUTES) return `Still marked as at the babysitter after ${Math.floor(visitMinutes(v, now) / 60)} hours.`;
  return null;
}

/** Finds a clash between [start, end] and any other live visit (an open visit runs until now). */
function overlapError(data: CareData, start: Instant, end: Instant | undefined, now: Date, ignoreId?: Id): string | null {
  const s = Date.parse(start);
  const e = Date.parse(end ?? now.toISOString());
  for (const v of liveVisits(data)) {
    if (v.id === ignoreId) continue;
    const vs = Date.parse(v.droppedOffAt);
    const ve = Date.parse(v.pickedUpAt ?? now.toISOString());
    if (s < ve && vs < e) {
      return `That overlaps the visit on ${formatDate(v.careDate, { year: false })} (${formatClock(v.droppedOffAt)}${v.pickedUpAt ? ` to ${formatClock(v.pickedUpAt)}` : ", still open"}).`;
    }
  }
  return null;
}

function personError(data: CareData, id: Id | undefined, role: "any" | "babysitter", label: string): string | null {
  const p = data.people.find((x) => x.id === id);
  if (!p) return `Choose ${label}.`;
  if (role === "babysitter" && p.role !== "babysitter") return `${p.name} isn't saved as a babysitter.`;
  return null;
}

function checkTimes(data: CareData, v: Pick<Visit, "droppedOffAt" | "pickedUpAt">, now: Date, ignoreId?: Id): string | null {
  if (isFuture(v.droppedOffAt, now)) return "The drop-off time is in the future.";
  if (v.pickedUpAt) {
    if (isFuture(v.pickedUpAt, now)) return "The pickup time is in the future.";
    if (Date.parse(v.pickedUpAt) <= Date.parse(v.droppedOffAt)) return `Pickup must be after drop-off (${formatClock(v.droppedOffAt)}).`;
    if (minutesBetween(v.droppedOffAt, v.pickedUpAt) > MAX_VISIT_MINUTES) return "That's more than 24 hours after drop-off. Check the date.";
  }
  return overlapError(data, v.droppedOffAt, v.pickedUpAt, now, ignoreId);
}

const expectedFor = (data: CareData, date: string): Visit["expected"] => {
  const s = scheduleFor(data, date);
  return { dropOff: s?.dropOff, pickUp: s?.pickUp };
};

export interface DropOffInput {
  at: Instant;
  by: Id;
  babysitterId: Id;
}

export function dropOff(data: CareData, input: DropOffInput, now: Date): Result {
  const open = openVisit(data);
  if (open) return fail(`She's already dropped off (since ${formatClock(open.droppedOffAt)}). Record the pickup first.`);
  const err = personError(data, input.by, "any", "who dropped her off") ?? personError(data, input.babysitterId, "babysitter", "the babysitter");
  if (err) return fail(err);
  const timeErr = checkTimes(data, { droppedOffAt: input.at }, now);
  if (timeErr) return fail(timeErr);
  const at = now.toISOString();
  const careDate = careDateOf(input.at);
  const visit: Visit = {
    id: newId(),
    careDate,
    droppedOffAt: new Date(input.at).toISOString(),
    droppedOffBy: input.by,
    babysitterId: input.babysitterId,
    expected: expectedFor(data, careDate),
    createdAt: at,
    updatedAt: at,
  };
  const next = { ...data, visits: [...data.visits, visit] };
  return { ok: true, data: withChanges(next, now, [{ target: "visit", targetId: visit.id, careDate, action: "create", field: "droppedOffAt", to: visit.droppedOffAt }]) };
}

export interface PickUpInput {
  at: Instant;
  by: Id;
}

export function pickUp(data: CareData, input: PickUpInput, now: Date): Result {
  const open = openVisit(data);
  if (!open) return fail("There's no drop-off to close. Record the drop-off first.");
  const err = personError(data, input.by, "any", "who picked her up");
  if (err) return fail(err);
  const pickedUpAt = new Date(input.at).toISOString();
  const timeErr = checkTimes(data, { droppedOffAt: open.droppedOffAt, pickedUpAt }, now, open.id);
  if (timeErr) return fail(timeErr);
  const updated: Visit = { ...open, pickedUpAt, pickedUpBy: input.by, updatedAt: now.toISOString() };
  const next = { ...data, visits: data.visits.map((v) => (v.id === open.id ? updated : v)) };
  return { ok: true, data: withChanges(next, now, [{ target: "visit", targetId: open.id, careDate: open.careDate, action: "update", field: "pickedUpAt", to: pickedUpAt }]) };
}

const reasonError = (reason: string) => (reason.trim().length < MIN_REASON_LENGTH ? "Add a short reason for the correction." : null);

export type VisitPatch = Partial<Pick<Visit, "droppedOffAt" | "droppedOffBy" | "pickedUpAt" | "pickedUpBy" | "babysitterId">>;
const VISIT_FIELDS: (keyof Visit)[] = ["droppedOffAt", "droppedOffBy", "pickedUpAt", "pickedUpBy", "babysitterId", "careDate"];

/** Corrects a visit's times or people. Every changed field is logged with the reason. */
export function correctVisit(data: CareData, id: Id, patch: VisitPatch, reason: string, now: Date): Result {
  const r = reasonError(reason);
  if (r) return fail(r);
  const before = data.visits.find((v) => v.id === id);
  if (!before || before.voided) return fail("That visit no longer exists.");
  const norm = (s: string | undefined) => (s ? new Date(s).toISOString() : s);
  const after: Visit = {
    ...before,
    ...patch,
    droppedOffAt: norm(patch.droppedOffAt) ?? before.droppedOffAt,
    pickedUpAt: "pickedUpAt" in patch ? norm(patch.pickedUpAt) : before.pickedUpAt,
    updatedAt: now.toISOString(),
  };
  if (after.pickedUpAt && !after.pickedUpBy) return fail("Choose who picked her up.");
  if (!after.pickedUpAt) after.pickedUpBy = undefined;
  if (!after.pickedUpAt) {
    const otherOpen = liveVisits(data).find((v) => v.id !== id && !v.pickedUpAt);
    if (otherOpen) return fail("Another visit is still open. Add a pickup time.");
  }
  after.careDate = careDateOf(after.droppedOffAt);
  if (after.careDate !== before.careDate) after.expected = expectedFor(data, after.careDate);
  const err =
    personError(data, after.droppedOffBy, "any", "who dropped her off") ??
    (after.pickedUpBy ? personError(data, after.pickedUpBy, "any", "who picked her up") : null) ??
    personError(data, after.babysitterId, "babysitter", "the babysitter") ??
    checkTimes(data, after, now, id);
  if (err) return fail(err);
  const diffs = fieldChanges(before, after, VISIT_FIELDS);
  if (!diffs.length) return fail("Nothing was changed.");
  const next = { ...data, visits: data.visits.map((v) => (v.id === id ? after : v)) };
  return {
    ok: true,
    data: withChanges(
      next,
      now,
      diffs.map((d) => ({ target: "visit" as const, targetId: id, careDate: after.careDate, action: "update" as const, reason: reason.trim(), ...d })),
    ),
  };
}

export interface PastVisitInput {
  droppedOffAt: Instant;
  droppedOffBy: Id;
  pickedUpAt: Instant;
  pickedUpBy: Id;
  babysitterId: Id;
}

/** Records a whole visit after the fact (forgot to tap). Needs a reason, like any correction. */
export function addPastVisit(data: CareData, input: PastVisitInput, reason: string, now: Date): Result {
  const r = reasonError(reason);
  if (r) return fail(r);
  const err =
    personError(data, input.droppedOffBy, "any", "who dropped her off") ??
    personError(data, input.pickedUpBy, "any", "who picked her up") ??
    personError(data, input.babysitterId, "babysitter", "the babysitter");
  if (err) return fail(err);
  const droppedOffAt = new Date(input.droppedOffAt).toISOString();
  const pickedUpAt = new Date(input.pickedUpAt).toISOString();
  const timeErr = checkTimes(data, { droppedOffAt, pickedUpAt }, now);
  if (timeErr) return fail(timeErr);
  const at = now.toISOString();
  const careDate = careDateOf(droppedOffAt);
  const visit: Visit = { id: newId(), careDate, droppedOffAt, droppedOffBy: input.droppedOffBy, pickedUpAt, pickedUpBy: input.pickedUpBy, babysitterId: input.babysitterId, expected: expectedFor(data, careDate), createdAt: at, updatedAt: at };
  const next = { ...data, visits: [...data.visits, visit] };
  return { ok: true, data: withChanges(next, now, [{ target: "visit", targetId: visit.id, careDate, action: "create", reason: reason.trim(), field: "droppedOffAt", to: droppedOffAt }, { target: "visit", targetId: visit.id, careDate, action: "create", reason: reason.trim(), field: "pickedUpAt", to: pickedUpAt }]) };
}

/** Removes a visit from reports and totals, keeping it in the history with the reason. */
export function voidVisit(data: CareData, id: Id, reason: string, now: Date): Result {
  const r = reasonError(reason);
  if (r) return fail(r);
  const v = data.visits.find((x) => x.id === id);
  if (!v || v.voided) return fail("That visit no longer exists.");
  const at = now.toISOString();
  const next = { ...data, visits: data.visits.map((x) => (x.id === id ? { ...x, voided: { at, reason: reason.trim() }, updatedAt: at } : x)) };
  return { ok: true, data: withChanges(next, now, [{ target: "visit", targetId: id, careDate: v.careDate, action: "void", reason: reason.trim() }]) };
}

export type DayStatus =
  | { kind: "waiting"; expected?: ClockTime }
  | { kind: "in"; visit: Visit; minutes: number }
  | { kind: "out"; visit: Visit; minutes: number; totalMinutes: number }
  | { kind: "fix"; visit: Visit; problem: string };

/** The one status shown at the top of the Today screen. */
export function statusNow(data: CareData, now: Date): DayStatus {
  for (const v of liveVisits(data)) {
    const problem = visitProblem(v, now);
    if (problem) return { kind: "fix", visit: v, problem };
  }
  const open = openVisit(data);
  if (open) return { kind: "in", visit: open, minutes: visitMinutes(open, now) };
  const today = careDateOf(now);
  const todays = visitsOn(data, today);
  const last = todays[todays.length - 1];
  if (last) return { kind: "out", visit: last, minutes: visitMinutes(last, now), totalMinutes: todays.reduce((s, v) => s + visitMinutes(v, now), 0) };
  return { kind: "waiting", expected: scheduleFor(data, today)?.dropOff };
}
