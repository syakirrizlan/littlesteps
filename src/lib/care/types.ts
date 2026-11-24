/**
 * LittleSteps data model. Everything lives in one CareData object, encrypted in the
 * phone's storage by the vault (lib/security/vault.ts). See docs/data-model.md.
 *
 * Conventions
 * - Instants are ISO 8601 UTC strings ("2026-11-24T00:12:00.000Z").
 * - Calendar dates are Kuala Lumpur dates, "YYYY-MM-DD". Clock times are "HH:mm" in Kuala Lumpur.
 * - Quantities are integers in small units: milk in ml, temperature in tenths of a °C (375 = 37.5 °C).
 * - Nothing is hard-deleted. Visits and entries are voided with a reason, and every change is logged.
 */

export const DATA_VERSION = 1 as const;

export type Id = string;
export type Instant = string;
export type CareDate = string;
export type ClockTime = string;

export type PersonRole = "family" | "babysitter";

export interface Person {
  id: Id;
  name: string;
  role: PersonRole;
  /** Hidden from pickers but kept for history. */
  archived?: boolean;
}

export interface Child {
  name: string;
  birthDate?: CareDate;
}

/** Usual times for one weekday (0 = Sunday … 6 = Saturday). */
export interface DaySchedule {
  weekday: number;
  dropOff?: ClockTime;
  pickUp?: ClockTime;
}

export interface Voided {
  at: Instant;
  reason: string;
}

export interface Visit {
  id: Id;
  /** Kuala Lumpur date of drop-off. A visit that runs past midnight stays on this date. */
  careDate: CareDate;
  droppedOffAt: Instant;
  droppedOffBy: Id;
  babysitterId: Id;
  pickedUpAt?: Instant;
  pickedUpBy?: Id;
  /** The usual times on the day of the visit, copied at drop-off so later schedule edits don't rewrite history. */
  expected: { dropOff?: ClockTime; pickUp?: ClockTime };
  voided?: Voided;
  createdAt: Instant;
  updatedAt: Instant;
}

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack" | "milk";
export type AmountEaten = "all" | "most" | "half" | "little" | "none";
export type ActivityKind = "play" | "outdoor" | "learning" | "reading" | "other";
export type Condition = "well" | "unsettled" | "unwell";
export type IncidentSeverity = "minor" | "attention" | "serious";

interface EntryBase {
  id: Id;
  careDate: CareDate;
  /** When it happened (for a nap: when she fell asleep). */
  at: Instant;
  detail?: string;
  voided?: Voided;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface MealEntry extends EntryBase {
  type: "meal";
  meal: MealKind;
  food?: string;
  amount: AmountEaten;
  /** Milk or formula only. */
  ml?: number;
}

export interface NapEntry extends EntryBase {
  type: "nap";
  /** Absent while she is still asleep. */
  end?: Instant;
}

export interface ActivityEntry extends EntryBase {
  type: "activity";
  kind: ActivityKind;
}

export interface HealthEntry extends EntryBase {
  type: "health";
  condition: Condition;
  /** Tenths of a degree Celsius. */
  temperatureTenths?: number;
}

export interface MedicationEntry extends EntryBase {
  type: "medication";
  instructionId: Id;
  dose: string;
}

export interface IncidentEntry extends EntryBase {
  type: "incident";
  severity: IncidentSeverity;
  detail: string;
  actionTaken?: string;
}

export interface NoteEntry extends EntryBase {
  type: "note";
  detail: string;
}

export type Entry = MealEntry | NapEntry | ActivityEntry | HealthEntry | MedicationEntry | IncidentEntry | NoteEntry;
export type EntryType = Entry["type"];

/** A medicine you have authorised the babysitter to give. */
export interface MedInstruction {
  id: Id;
  medicine: string;
  dose: string;
  when: string;
  notes?: string;
  active: boolean;
  createdAt: Instant;
}

export type ChangeAction = "create" | "update" | "void";

/** One line of the change history. Field changes record the old and new value. */
export interface Change {
  id: Id;
  at: Instant;
  target: "visit" | "entry";
  targetId: Id;
  careDate: CareDate;
  action: ChangeAction;
  field?: string;
  from?: string;
  to?: string;
  reason?: string;
}

export interface Settings {
  /** Minutes after the usual time before drop-off counts as late or pickup as early. */
  graceMinutes: number;
  backupReminderDays: number;
  lastBackupAt?: Instant;
}

export interface CareData {
  version: typeof DATA_VERSION;
  child: Child | null;
  people: Person[];
  schedule: DaySchedule[];
  visits: Visit[];
  entries: Entry[];
  medInstructions: MedInstruction[];
  changes: Change[];
  settings: Settings;
}

export function emptyCareData(): CareData {
  return {
    version: DATA_VERSION,
    child: null,
    people: [],
    schedule: [],
    visits: [],
    entries: [],
    medInstructions: [],
    changes: [],
    settings: { graceMinutes: 15, backupReminderDays: 7 },
  };
}

/** Operations return either the new data or a message the person can act on. */
export type Result<T = CareData> = { ok: true; data: T } | { ok: false; error: string };
