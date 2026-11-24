/** Child profile, people, usual times, medicine instructions and settings. */
import type { CareData, Child, ClockTime, DaySchedule, Id, MedInstruction, Person, PersonRole, Result } from "./types";
import { isCareDate, isClockTime } from "./time";
import { newId } from "./history";

const fail = (error: string): Result => ({ ok: false, error });
const NAME_MAX = 60;

export function setChild(data: CareData, child: Child): Result {
  const name = child.name.trim();
  if (!name) return fail("Enter her name.");
  if (name.length > NAME_MAX) return fail("Keep the name under 60 characters.");
  if (child.birthDate && !isCareDate(child.birthDate)) return fail("Check the birth date.");
  return { ok: true, data: { ...data, child: { name, birthDate: child.birthDate || undefined } } };
}

export function addPerson(data: CareData, name: string, role: PersonRole): Result<{ data: CareData; id: Id }> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Enter a name." };
  if (n.length > NAME_MAX) return { ok: false, error: "Keep the name under 60 characters." };
  if (data.people.some((p) => !p.archived && p.role === role && p.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: `${n} is already saved.` };
  const person: Person = { id: newId(), name: n, role };
  return { ok: true, data: { data: { ...data, people: [...data.people, person] }, id: person.id } };
}

export function renamePerson(data: CareData, id: Id, name: string): Result {
  const n = name.trim();
  if (!n) return fail("Enter a name.");
  if (n.length > NAME_MAX) return fail("Keep the name under 60 characters.");
  return { ok: true, data: { ...data, people: data.people.map((p) => (p.id === id ? { ...p, name: n } : p)) } };
}

/** People are never deleted (history refers to them); archiving hides them from pickers. */
export function setPersonArchived(data: CareData, id: Id, archived: boolean): Result {
  return { ok: true, data: { ...data, people: data.people.map((p) => (p.id === id ? { ...p, archived } : p)) } };
}

export function setSchedule(data: CareData, weekday: number, times: { dropOff?: ClockTime; pickUp?: ClockTime }): Result {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail("Choose a day.");
  for (const t of [times.dropOff, times.pickUp]) if (t && !isClockTime(t)) return fail("Use a time like 08:00.");
  if (times.dropOff && times.pickUp && times.pickUp <= times.dropOff) return fail("Usual pickup must be after usual drop-off.");
  const rest = data.schedule.filter((s) => s.weekday !== weekday);
  const entry: DaySchedule = { weekday, dropOff: times.dropOff || undefined, pickUp: times.pickUp || undefined };
  const schedule = entry.dropOff || entry.pickUp ? [...rest, entry] : rest;
  return { ok: true, data: { ...data, schedule: schedule.sort((a, b) => a.weekday - b.weekday) } };
}

export function addMedInstruction(data: CareData, m: Pick<MedInstruction, "medicine" | "dose" | "when" | "notes">, now: Date): Result {
  if (!m.medicine.trim()) return fail("Enter the medicine.");
  if (!m.dose.trim()) return fail("Enter the dose you authorise.");
  if (!m.when.trim()) return fail("Say when it may be given.");
  const ins: MedInstruction = { id: newId(), medicine: m.medicine.trim(), dose: m.dose.trim(), when: m.when.trim(), notes: m.notes?.trim() || undefined, active: true, createdAt: now.toISOString() };
  return { ok: true, data: { ...data, medInstructions: [...data.medInstructions, ins] } };
}

export function setMedInstructionActive(data: CareData, id: Id, active: boolean): Result {
  return { ok: true, data: { ...data, medInstructions: data.medInstructions.map((m) => (m.id === id ? { ...m, active } : m)) } };
}

export function setGraceMinutes(data: CareData, minutes: number): Result {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) return fail("Use 0 to 120 minutes.");
  return { ok: true, data: { ...data, settings: { ...data.settings, graceMinutes: minutes } } };
}

export const activePeople = (data: CareData, role?: PersonRole) => data.people.filter((p) => !p.archived && (!role || p.role === role));

/** Ready to record once there's a child, a family member and a babysitter. */
export const isSetUp = (data: CareData) => !!data.child && activePeople(data, "family").length > 0 && activePeople(data, "babysitter").length > 0;
