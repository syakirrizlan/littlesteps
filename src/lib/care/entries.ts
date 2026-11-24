/**
 * Day entries: meals, naps, activities, health, medication, incidents and notes.
 * Pure functions, like attendance.ts.
 */
import type { CareData, Entry, Id, Instant, NapEntry, Result } from "./types";
import { careDateOf, minutesBetween } from "./time";
import { liveVisits, MIN_REASON_LENGTH } from "./attendance";
import { fieldChanges, newId, withChanges } from "./history";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What a form submits: an entry without its bookkeeping fields. */
export type EntryDraft = DistributiveOmit<Entry, "id" | "careDate" | "createdAt" | "updatedAt" | "voided">;

const FUTURE_SLACK_MS = 2 * 60_000;
export const MAX_NAP_MINUTES = 12 * 60;
export const MAX_TEXT = 500;
const MEALS = ["breakfast", "lunch", "dinner", "snack", "milk"];
const AMOUNTS = ["all", "most", "half", "little", "none"];
const ACTIVITIES = ["play", "outdoor", "learning", "reading", "other"];
const CONDITIONS = ["well", "unsettled", "unwell"];
const SEVERITIES = ["minor", "attention", "serious"];

const fail = (error: string): Result => ({ ok: false, error });
const isFuture = (at: Instant, now: Date) => Date.parse(at) > now.getTime() + FUTURE_SLACK_MS;

export const liveEntries = (data: CareData) => data.entries.filter((e) => !e.voided).sort((a, b) => a.at.localeCompare(b.at));
export const entriesOn = (data: CareData, date: string) => liveEntries(data).filter((e) => e.careDate === date);

/** Minutes asleep; an unfinished nap counts up to now. */
export function napMinutes(n: NapEntry, now: Date): number {
  return minutesBetween(n.at, n.end ?? now.toISOString());
}

/** An entry made during a visit belongs to that visit's day, even after midnight. */
export function careDateForEntry(data: CareData, at: Instant, now: Date): string {
  const t = Date.parse(at);
  for (const v of liveVisits(data)) {
    const end = Date.parse(v.pickedUpAt ?? now.toISOString());
    if (Date.parse(v.droppedOffAt) <= t && t <= end) return v.careDate;
  }
  return careDateOf(at);
}

function validate(data: CareData, d: EntryDraft, now: Date, ignoreId?: Id): string | null {
  if (Number.isNaN(Date.parse(d.at))) return "Choose a time.";
  if (isFuture(d.at, now)) return "That time is in the future.";
  if (d.detail !== undefined && d.detail.length > MAX_TEXT) return `Keep notes under ${MAX_TEXT} characters.`;
  switch (d.type) {
    case "meal":
      if (!MEALS.includes(d.meal)) return "Choose which meal.";
      if (!AMOUNTS.includes(d.amount)) return "Choose how much she ate.";
      if (d.ml !== undefined) {
        if (d.meal !== "milk") return "Millilitres are only for milk.";
        if (!Number.isInteger(d.ml) || d.ml < 1 || d.ml > 2000) return "Milk should be a whole number of ml, up to 2000.";
      }
      if (d.food && d.food.length > 120) return "Keep the food description short.";
      return null;
    case "nap": {
      if (d.end !== undefined) {
        if (Number.isNaN(Date.parse(d.end))) return "Choose when she woke up.";
        if (isFuture(d.end, now)) return "The wake-up time is in the future.";
        if (Date.parse(d.end) <= Date.parse(d.at)) return "She must wake up after she fell asleep.";
        if (minutesBetween(d.at, d.end) > MAX_NAP_MINUTES) return "That nap is longer than 12 hours. Check the times.";
      }
      const s = Date.parse(d.at);
      const e = Date.parse(d.end ?? now.toISOString());
      for (const n of liveEntries(data)) {
        if (n.type !== "nap" || n.id === ignoreId) continue;
        if (!d.end && !n.end) return "Another nap is still running. End it first.";
        const ns = Date.parse(n.at);
        const ne = Date.parse(n.end ?? now.toISOString());
        if (s < ne && ns < e) return "That overlaps another nap.";
      }
      return null;
    }
    case "activity":
      return ACTIVITIES.includes(d.kind) ? null : "Choose an activity.";
    case "health":
      if (!CONDITIONS.includes(d.condition)) return "Choose how she was.";
      if (d.temperatureTenths !== undefined && (!Number.isInteger(d.temperatureTenths) || d.temperatureTenths < 340 || d.temperatureTenths > 430))
        return "Temperature should be between 34.0 and 43.0 °C.";
      return null;
    case "medication": {
      const ins = data.medInstructions.find((m) => m.id === d.instructionId);
      if (!ins) return "Choose one of your medicine instructions.";
      if (!ins.active && !ignoreId) return `${ins.medicine} is no longer authorised. Turn it back on in Settings first.`;
      if (!d.dose.trim()) return "Write the dose that was given.";
      return null;
    }
    case "incident":
      if (!SEVERITIES.includes(d.severity)) return "Choose how serious it was.";
      if (!d.detail?.trim()) return "Describe what happened.";
      if (d.actionTaken && d.actionTaken.length > MAX_TEXT) return `Keep this under ${MAX_TEXT} characters.`;
      return null;
    case "note":
      return d.detail?.trim() ? null : "Write the note.";
  }
}

function clean(d: EntryDraft): EntryDraft {
  const out = { ...d, at: new Date(d.at).toISOString() } as EntryDraft;
  if (out.type === "nap" && out.end) out.end = new Date(out.end).toISOString();
  const trimmed = out.detail?.trim();
  if (trimmed) out.detail = trimmed;
  else delete out.detail;
  return out;
}

export function addEntry(data: CareData, draft: EntryDraft, now: Date): Result {
  const err = validate(data, draft, now);
  if (err) return fail(err);
  const d = clean(draft);
  const at = now.toISOString();
  const entry = { ...d, id: newId(), careDate: careDateForEntry(data, d.at, now), createdAt: at, updatedAt: at } as Entry;
  const next = { ...data, entries: [...data.entries, entry] };
  return { ok: true, data: withChanges(next, now, [{ target: "entry", targetId: entry.id, careDate: entry.careDate, action: "create", field: entry.type }]) };
}

const ENTRY_FIELDS = ["at", "end", "meal", "food", "amount", "ml", "kind", "condition", "temperatureTenths", "instructionId", "dose", "severity", "detail", "actionTaken", "careDate"] as const;

export function updateEntry(data: CareData, id: Id, draft: EntryDraft, now: Date, reason?: string): Result {
  const before = data.entries.find((e) => e.id === id);
  if (!before || before.voided) return fail("That entry no longer exists.");
  if (before.type !== draft.type) return fail("An entry can't change type. Remove it and add a new one.");
  const err = validate(data, draft, now, id);
  if (err) return fail(err);
  const d = clean(draft);
  const after = { ...d, id, careDate: careDateForEntry(data, d.at, now), createdAt: before.createdAt, updatedAt: now.toISOString() } as Entry;
  const diffs = fieldChanges(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [...ENTRY_FIELDS]);
  if (!diffs.length) return { ok: true, data };
  const next = { ...data, entries: data.entries.map((e) => (e.id === id ? after : e)) };
  return {
    ok: true,
    data: withChanges(
      next,
      now,
      diffs.map((c) => ({ target: "entry" as const, targetId: id, careDate: after.careDate, action: "update" as const, reason: reason?.trim() || undefined, ...c })),
    ),
  };
}

/** The editable part of a saved entry. */
export function toDraft(e: Entry): EntryDraft {
  const copy: Partial<Entry> = { ...e };
  delete copy.id;
  delete copy.careDate;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.voided;
  return copy as EntryDraft;
}

export function endNap(data: CareData, id: Id, end: Instant, now: Date): Result {
  const nap = data.entries.find((e) => e.id === id);
  if (!nap || nap.type !== "nap" || nap.voided) return fail("That nap no longer exists.");
  return updateEntry(data, id, { ...toDraft(nap), end } as EntryDraft, now);
}

export function voidEntry(data: CareData, id: Id, reason: string, now: Date): Result {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("Add a short reason for removing it.");
  const e = data.entries.find((x) => x.id === id);
  if (!e || e.voided) return fail("That entry no longer exists.");
  const at = now.toISOString();
  const next = { ...data, entries: data.entries.map((x) => (x.id === id ? ({ ...x, voided: { at, reason: reason.trim() }, updatedAt: at } as Entry) : x)) };
  return { ok: true, data: withChanges(next, now, [{ target: "entry", targetId: id, careDate: e.careDate, action: "void", reason: reason.trim() }]) };
}

export const openNap = (data: CareData) => liveEntries(data).find((e): e is NapEntry => e.type === "nap" && !e.end);
