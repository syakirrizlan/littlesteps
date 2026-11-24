/** Spreadsheet export (CSV) of every visit and entry, for your own records. */
import type { CareData, Entry } from "./types";
import { clockOf, minutesBetween } from "./time";
import { liveVisits } from "./attendance";

const HEADER = ["date", "record", "start", "end", "minutes", "details", "by", "babysitter", "voided_reason"];

/** Quotes a cell and stops spreadsheet apps from treating it as a formula. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function entryDetails(data: CareData, e: Entry): string {
  switch (e.type) {
    case "meal":
      return [e.meal, e.food, `ate ${e.amount}`, e.ml ? `${e.ml} ml` : "", e.detail].filter(Boolean).join("; ");
    case "nap":
      return e.detail ?? "";
    case "activity":
      return [e.kind, e.detail].filter(Boolean).join("; ");
    case "health":
      return [e.condition, e.temperatureTenths ? `${(e.temperatureTenths / 10).toFixed(1)} °C` : "", e.detail].filter(Boolean).join("; ");
    case "medication": {
      const m = data.medInstructions.find((x) => x.id === e.instructionId);
      return [m?.medicine ?? "medicine", e.dose, e.detail].filter(Boolean).join("; ");
    }
    case "incident":
      return [e.severity, e.detail, e.actionTaken ? `action: ${e.actionTaken}` : ""].filter(Boolean).join("; ");
    case "note":
      return e.detail;
  }
}

export function toCsv(data: CareData, opts: { includeVoided?: boolean } = {}): string {
  const name = (id?: string) => data.people.find((p) => p.id === id)?.name ?? "";
  const rows: string[][] = [];
  const visits = opts.includeVoided ? data.visits : liveVisits(data);
  for (const v of visits) {
    rows.push([
      v.careDate,
      "visit",
      clockOf(v.droppedOffAt),
      v.pickedUpAt ? clockOf(v.pickedUpAt) : "",
      v.pickedUpAt ? String(minutesBetween(v.droppedOffAt, v.pickedUpAt)) : "",
      v.pickedUpAt && v.pickedUpBy ? `picked up by ${name(v.pickedUpBy)}` : "no pickup recorded",
      name(v.droppedOffBy),
      name(v.babysitterId),
      v.voided?.reason ?? "",
    ]);
  }
  for (const e of data.entries) {
    if (e.voided && !opts.includeVoided) continue;
    rows.push([
      e.careDate,
      e.type,
      clockOf(e.at),
      e.type === "nap" && e.end ? clockOf(e.end) : "",
      e.type === "nap" && e.end ? String(minutesBetween(e.at, e.end)) : "",
      entryDetails(data, e),
      "",
      "",
      e.voided?.reason ?? "",
    ]);
  }
  rows.sort((a, b) => (a[0] + a[2]).localeCompare(b[0] + b[2]));
  return [HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
