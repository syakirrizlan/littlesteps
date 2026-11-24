/** Words shown in the app for each kind of record. */
import type { ActivityKind, AmountEaten, CareData, Condition, Entry, EntryType, IncidentSeverity, MealKind } from "./types";
import { formatClock, formatDuration, minutesBetween } from "./time";

export const ENTRY_LABEL: Record<EntryType, string> = {
  meal: "Meal",
  nap: "Nap",
  activity: "Activity",
  health: "Health",
  medication: "Medicine",
  incident: "Incident",
  note: "Note",
};

export const MEAL_LABEL: Record<MealKind, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", milk: "Milk" };
export const AMOUNT_LABEL: Record<AmountEaten, string> = { all: "Ate all", most: "Ate most", half: "Ate half", little: "Ate a little", none: "Didn't eat" };
export const ACTIVITY_LABEL: Record<ActivityKind, string> = { play: "Play", outdoor: "Outdoors", learning: "Learning", reading: "Reading", other: "Other" };
export const CONDITION_LABEL: Record<Condition, string> = { well: "Well", unsettled: "Unsettled", unwell: "Unwell" };
export const SEVERITY_LABEL: Record<IncidentSeverity, string> = { minor: "Minor", attention: "Needs attention", serious: "Serious" };

export const FIELD_LABEL: Record<string, string> = {
  droppedOffAt: "Drop-off time",
  droppedOffBy: "Dropped off by",
  pickedUpAt: "Pickup time",
  pickedUpBy: "Picked up by",
  babysitterId: "Babysitter",
  careDate: "Day",
  at: "Time",
  end: "Woke up",
  amount: "Amount",
  ml: "Millilitres",
  meal: "Meal",
  food: "Food",
  kind: "Activity",
  condition: "Condition",
  temperatureTenths: "Temperature",
  dose: "Dose",
  severity: "Severity",
  detail: "Details",
  actionTaken: "Action taken",
  instructionId: "Medicine",
};

/** One-line title for a timeline item. */
export function entryTitle(data: CareData, e: Entry): string {
  switch (e.type) {
    case "meal":
      return e.meal === "milk" && e.ml ? `Milk · ${e.ml} ml` : `${MEAL_LABEL[e.meal]}${e.food ? ` · ${e.food}` : ""}`;
    case "nap":
      return e.end ? `Nap · ${formatDuration(minutesBetween(e.at, e.end))}` : "Napping now";
    case "activity":
      return ACTIVITY_LABEL[e.kind];
    case "health":
      return `${CONDITION_LABEL[e.condition]}${e.temperatureTenths ? ` · ${(e.temperatureTenths / 10).toFixed(1)} °C` : ""}`;
    case "medication":
      return `${data.medInstructions.find((m) => m.id === e.instructionId)?.medicine ?? "Medicine"} · ${e.dose}`;
    case "incident":
      return `Incident · ${SEVERITY_LABEL[e.severity]}`;
    case "note":
      return "Note";
  }
}

/** Second line for a timeline item. */
export function entryDetail(e: Entry): string | undefined {
  switch (e.type) {
    case "meal":
      return [AMOUNT_LABEL[e.amount], e.detail].filter(Boolean).join(" · ");
    case "nap":
      return [e.end ? `${formatClock(e.at)} to ${formatClock(e.end)}` : `Asleep since ${formatClock(e.at)}`, e.detail].filter(Boolean).join(" · ");
    case "incident":
      return [e.detail, e.actionTaken ? `Action: ${e.actionTaken}` : ""].filter(Boolean).join(" · ");
    default:
      return e.detail;
  }
}

export function personName(data: CareData, id?: string): string {
  return data.people.find((p) => p.id === id)?.name ?? "Unknown";
}
