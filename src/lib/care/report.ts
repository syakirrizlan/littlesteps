/**
 * Daily report and monthly overview. Built from the records each time; never stored.
 */
import type { CareData, CareDate, Change, Entry, HealthEntry, IncidentEntry, MealEntry, MedInstruction, MedicationEntry, NapEntry, Visit } from "./types";
import { scheduleFor, visitFlags, visitMinutes, visitProblem, visitsOn } from "./attendance";
import { entriesOn, napMinutes } from "./entries";
import { daysInMonth } from "./time";

export interface ReportVisit {
  visit: Visit;
  minutes: number;
  lateBy: number | null;
  earlyBy: number | null;
  problem: string | null;
  droppedOffBy: string;
  pickedUpBy?: string;
  babysitter: string;
}

export interface DailyReport {
  date: CareDate;
  childName: string;
  visits: ReportVisit[];
  totalMinutes: number;
  meals: MealEntry[];
  naps: { nap: NapEntry; minutes: number; ongoing: boolean }[];
  napMinutes: number;
  activities: Entry[];
  health: HealthEntry[];
  medications: { entry: MedicationEntry; instruction?: MedInstruction }[];
  incidents: IncidentEntry[];
  notes: Entry[];
  /** Everything in time order, for the timeline. */
  timeline: Entry[];
  corrections: Change[];
  isEmpty: boolean;
}

const nameOf = (data: CareData, id?: string) => data.people.find((p) => p.id === id)?.name ?? "Unknown";

export function buildDailyReport(data: CareData, date: CareDate, now: Date): DailyReport {
  const visits = visitsOn(data, date).map((v): ReportVisit => {
    const f = visitFlags(v, data.settings.graceMinutes);
    return {
      visit: v,
      minutes: visitMinutes(v, now),
      lateBy: f.lateBy,
      earlyBy: f.earlyBy,
      problem: visitProblem(v, now),
      droppedOffBy: nameOf(data, v.droppedOffBy),
      pickedUpBy: v.pickedUpBy ? nameOf(data, v.pickedUpBy) : undefined,
      babysitter: nameOf(data, v.babysitterId),
    };
  });
  const entries = entriesOn(data, date);
  const of = <T extends Entry["type"]>(t: T) => entries.filter((e): e is Extract<Entry, { type: T }> => e.type === t);
  const naps = of("nap").map((nap) => ({ nap, minutes: napMinutes(nap, now), ongoing: !nap.end }));
  return {
    date,
    childName: data.child?.name ?? "",
    visits,
    totalMinutes: visits.reduce((s, v) => s + v.minutes, 0),
    meals: of("meal"),
    naps,
    napMinutes: naps.reduce((s, n) => s + n.minutes, 0),
    activities: of("activity"),
    health: of("health"),
    medications: of("medication").map((entry) => ({ entry, instruction: data.medInstructions.find((m) => m.id === entry.instructionId) })),
    incidents: of("incident"),
    notes: of("note"),
    timeline: entries,
    corrections: data.changes.filter((c) => c.careDate === date && (c.action === "void" || c.reason)),
    isEmpty: visits.length === 0 && entries.length === 0,
  };
}

export interface MonthDay {
  date: CareDate;
  minutes: number;
  visits: number;
  late: boolean;
  early: boolean;
  needsFix: boolean;
  incidents: number;
  scheduled: boolean;
}

export interface MonthSummary {
  month: string;
  days: MonthDay[];
  daysAttended: number;
  totalMinutes: number;
  averageMinutes: number;
  lateCount: number;
  earlyCount: number;
  incidentCount: number;
}

export function monthSummary(data: CareData, month: string, now: Date): MonthSummary {
  const days = daysInMonth(month).map((date): MonthDay => {
    const vs = visitsOn(data, date);
    const flags = vs.map((v) => visitFlags(v, data.settings.graceMinutes));
    const sch = scheduleFor(data, date);
    return {
      date,
      minutes: vs.reduce((s, v) => s + visitMinutes(v, now), 0),
      visits: vs.length,
      late: flags.some((f) => f.lateBy !== null),
      early: flags.some((f) => f.earlyBy !== null),
      needsFix: vs.some((v) => visitProblem(v, now) !== null),
      incidents: entriesOn(data, date).filter((e) => e.type === "incident").length,
      scheduled: !!(sch?.dropOff || sch?.pickUp),
    };
  });
  const attended = days.filter((d) => d.visits > 0);
  const totalMinutes = attended.reduce((s, d) => s + d.minutes, 0);
  return {
    month,
    days,
    daysAttended: attended.length,
    totalMinutes,
    averageMinutes: attended.length ? Math.round(totalMinutes / attended.length) : 0,
    lateCount: days.filter((d) => d.late).length,
    earlyCount: days.filter((d) => d.early).length,
    incidentCount: days.reduce((s, d) => s + d.incidents, 0),
  };
}
