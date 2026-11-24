/**
 * Checks that stored or restored data has the right shape, and upgrades older versions.
 * Add a step to MIGRATIONS whenever DATA_VERSION goes up, so old backups keep restoring.
 */
import { DATA_VERSION, type CareData } from "./types";
import { isCareDate, isClockTime, isInstant } from "./time";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown) => v === undefined || isStr(v);
const optInstant = (v: unknown) => v === undefined || isInstant(v);
const isVoided = (v: unknown) => v === undefined || (isObj(v) && isInstant(v.at) && isStr(v.reason));

/** Upgrade steps: MIGRATIONS[n] turns version n into version n + 1. */
const MIGRATIONS: Record<number, (d: Obj) => Obj> = {};

function validVisit(v: unknown): boolean {
  return (
    isObj(v) && isStr(v.id) && isCareDate(v.careDate) && isInstant(v.droppedOffAt) && isStr(v.droppedOffBy) && isStr(v.babysitterId) &&
    optInstant(v.pickedUpAt) && optStr(v.pickedUpBy) && isObj(v.expected) && isVoided(v.voided) && isInstant(v.createdAt) && isInstant(v.updatedAt)
  );
}

const ENTRY_TYPES = ["meal", "nap", "activity", "health", "medication", "incident", "note"];
function validEntry(e: unknown): boolean {
  return (
    isObj(e) && isStr(e.id) && ENTRY_TYPES.includes(e.type as string) && isCareDate(e.careDate) && isInstant(e.at) && optStr(e.detail) &&
    isVoided(e.voided) && isInstant(e.createdAt) && isInstant(e.updatedAt) && optInstant(e.end) &&
    (e.ml === undefined || Number.isInteger(e.ml)) && (e.temperatureTenths === undefined || Number.isInteger(e.temperatureTenths))
  );
}

function valid(d: Obj): d is Obj & CareData {
  const s = d.settings;
  return (
    d.version === DATA_VERSION &&
    (d.child === null || (isObj(d.child) && isStr(d.child.name) && (d.child.birthDate === undefined || isCareDate(d.child.birthDate)))) &&
    Array.isArray(d.people) && d.people.every((p) => isObj(p) && isStr(p.id) && isStr(p.name) && (p.role === "family" || p.role === "babysitter")) &&
    Array.isArray(d.schedule) && d.schedule.every((x) => isObj(x) && Number.isInteger(x.weekday) && (x.dropOff === undefined || isClockTime(x.dropOff)) && (x.pickUp === undefined || isClockTime(x.pickUp))) &&
    Array.isArray(d.visits) && d.visits.every(validVisit) &&
    Array.isArray(d.entries) && d.entries.every(validEntry) &&
    Array.isArray(d.medInstructions) && d.medInstructions.every((m) => isObj(m) && isStr(m.id) && isStr(m.medicine) && typeof m.active === "boolean") &&
    Array.isArray(d.changes) && d.changes.every((c) => isObj(c) && isStr(c.id) && isInstant(c.at) && isStr(c.targetId)) &&
    isObj(s) && Number.isInteger(s.graceMinutes) && Number.isInteger(s.backupReminderDays) && optInstant(s.lastBackupAt)
  );
}

/** Returns valid, current-version data, or null if this isn't LittleSteps data or comes from a newer app. */
export function parseCareData(raw: unknown): CareData | null {
  if (!isObj(raw) || !Number.isInteger(raw.version)) return null;
  let d: Obj = raw;
  let v = d.version as number;
  if (v > DATA_VERSION) return null;
  while (v < DATA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    d = step(d);
    v += 1;
  }
  return valid(d) ? (d as CareData) : null;
}
