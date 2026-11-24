"use client";

import { useState } from "react";
import { buildDailyReport, type ReportVisit } from "@/lib/care/report";
import { entryDetail, entryTitle, FIELD_LABEL, personName, MEAL_LABEL } from "@/lib/care/labels";
import { useCareData } from "@/lib/care/store";
import { formatClock, formatClockTime, formatDate, formatDuration, isInstant } from "@/lib/care/time";
import type { CareData, Change, Entry, Visit } from "@/lib/care/types";
import { CorrectVisitSheet } from "./AttendanceSheets";
import { EntrySheet, TYPE_TINT } from "./EntrySheet";
import { Card, cx, Icon } from "./ui";

type Editing = { kind: "visit"; visit: Visit } | { kind: "entry"; entry: Entry } | null;

/** The day on one screen: times, totals, timeline and corrections. Tapping a row edits it. */
export function DayReport({ date, now, onToast, showVisits = true }: { date: string; now: Date; onToast: (msg: string) => void; showVisits?: boolean }) {
  const data = useCareData();
  const r = buildDailyReport(data, date, now);
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const done = (msg: string) => {
    setEditing(null);
    onToast(msg);
  };

  const mealsLine = r.meals.length ? r.meals.map((m) => (m.meal === "milk" && m.ml ? `milk ${m.ml} ml` : MEAL_LABEL[m.meal].toLowerCase())).join(", ") : "None recorded";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" aria-label="Day summary">
        <Tile label="At babysitter" value={r.visits.length ? formatDuration(r.totalMinutes) : "–"} />
        <Tile label="Meals" value={String(r.meals.length)} />
        <Tile label="Nap" value={r.naps.length ? formatDuration(r.napMinutes) : "–"} />
      </div>

      {showVisits && r.visits.length > 0 && (
        <Card className="!p-0">
          <h3 className="eyebrow px-5 pt-4">Drop-off and pickup</h3>
          <ul className="divide-y divide-line">
            {r.visits.map((v) => (
              <li key={v.visit.id}>
                <VisitRow v={v} onEdit={() => setEditing({ kind: "visit", visit: v.visit })} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="!p-0">
        <h3 className="eyebrow px-5 pt-4">The day</h3>
        {r.timeline.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-muted">Nothing recorded yet. Use “Add to the day” for meals, naps, play, health and notes.</p>
        ) : (
          <ol className="relative px-5 pb-3 pt-2">
            <span className="absolute bottom-6 left-[38px] top-6 w-0.5 bg-line" aria-hidden />
            {r.timeline.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing({ kind: "entry", entry: e })} className="group relative flex w-full items-start gap-3 rounded-2xl py-2.5 text-left">
                  <span className={cx("relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-surface", TYPE_TINT[e.type])}>
                    <Icon name={e.type} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold group-hover:text-accent">{entryTitle(data, e)}</span>
                      <span className="figure shrink-0 text-sm text-muted">{formatClock(e.at)}</span>
                    </span>
                    {entryDetail(e) && <span className="mt-0.5 block break-words text-sm text-muted">{entryDetail(e)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {(r.incidents.length > 0 || r.health.some((h) => h.condition !== "well")) && (
        <p className="rounded-2xl bg-st-fix-soft px-4 py-3 text-sm font-medium text-st-fix">
          {r.incidents.length > 0 ? `${r.incidents.length} incident${r.incidents.length > 1 ? "s" : ""} recorded.` : "She wasn't fully well today."} See the timeline above.
        </p>
      )}

      <details className="rounded-[24px] border border-line bg-surface px-5 py-4 text-sm">
        <summary className="cursor-pointer font-semibold">Written summary</summary>
        <div className="mt-3 flex flex-col gap-1.5 text-muted">
          <p><b className="text-foreground">{r.childName}</b>, {formatDate(date)}</p>
          {r.visits.map((v) => (
            <p key={v.visit.id}>{formatClock(v.visit.droppedOffAt)} to {v.visit.pickedUpAt ? formatClock(v.visit.pickedUpAt) : "still there"} ({formatDuration(v.minutes)}) with {v.babysitter}.</p>
          ))}
          <p>Meals: {mealsLine}.</p>
          <p>Naps: {r.naps.length ? r.naps.map((n) => `${formatClock(n.nap.at)}${n.nap.end ? `–${formatClock(n.nap.end)}` : " (asleep)"}`).join(", ") + ` · ${formatDuration(r.napMinutes)} total` : "none recorded"}.</p>
          {r.activities.length > 0 && <p>Activities: {r.activities.map((a) => entryTitle(data, a).toLowerCase()).join(", ")}.</p>}
          {r.health.length > 0 && <p>Health: {r.health.map((h) => entryTitle(data, h)).join("; ")}.</p>}
          {r.medications.length > 0 && <p>Medicine: {r.medications.map((m) => `${m.instruction?.medicine ?? "medicine"} ${m.entry.dose} at ${formatClock(m.entry.at)}`).join("; ")}.</p>}
          {r.incidents.length > 0 && <p>Incidents: {r.incidents.map((i) => i.detail).join("; ")}.</p>}
          {r.notes.length > 0 && <p>Notes: {r.notes.map((n) => n.detail).join("; ")}.</p>}
        </div>
      </details>

      {r.corrections.length > 0 && <Corrections data={data} changes={r.corrections} />}

      {editing?.kind === "visit" && <CorrectVisitSheet visit={editing.visit} onClose={close} onDone={done} />}
      {editing?.kind === "entry" && <EntrySheet date={date} entry={editing.entry} onClose={close} onDone={done} />}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-3 py-3">
      <span className="figure display text-[1.35rem]">{value}</span>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

function VisitRow({ v, onEdit }: { v: ReportVisit; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-surface-2/60">
      <span className="flex items-center justify-between gap-3">
        <span className="figure display text-lg">
          {formatClock(v.visit.droppedOffAt)} <span className="text-muted">→</span> {v.visit.pickedUpAt ? formatClock(v.visit.pickedUpAt) : "…"}
        </span>
        <span className="figure text-sm font-semibold text-muted">{formatDuration(v.minutes)}</span>
      </span>
      <span className="text-sm text-muted">
        Dropped off by {v.droppedOffBy}
        {v.pickedUpBy ? `, picked up by ${v.pickedUpBy}` : ""} · {v.babysitter}
      </span>
      {(v.lateBy || v.earlyBy || v.problem) && (
        <span className="flex flex-wrap gap-1.5">
          {v.problem && <Pill tone="fix">{v.problem}</Pill>}
          {v.lateBy && <Pill tone="fix">Late drop-off · {formatDuration(v.lateBy)} after {formatClockTime(v.visit.expected.dropOff!)}</Pill>}
          {v.earlyBy && <Pill tone="out">Early pickup · {formatDuration(v.earlyBy)} before {formatClockTime(v.visit.expected.pickUp!)}</Pill>}
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
        <Icon name="edit" size={14} /> Correct
      </span>
    </button>
  );
}

export function Pill({ tone, children }: { tone: "fix" | "out" | "in" | "wait"; children: React.ReactNode }) {
  const t = { fix: "bg-st-fix-soft text-st-fix", out: "bg-st-out-soft text-st-out", in: "bg-st-in-soft text-st-in", wait: "bg-st-wait-soft text-st-wait" }[tone];
  return <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", t)}>{children}</span>;
}

function showValue(data: CareData, field: string | undefined, v: string | undefined): string {
  if (v === undefined || v === "") return "empty";
  if (isInstant(v)) return formatClock(v);
  if (field && /By$|babysitterId/.test(field)) return personName(data, v);
  if (field === "temperatureTenths") return `${(Number(v) / 10).toFixed(1)} °C`;
  return v;
}

function Corrections({ data, changes }: { data: CareData; changes: Change[] }) {
  return (
    <Card>
      <h3 className="eyebrow">Change history</h3>
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {changes.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {c.action === "void" ? `${c.target === "visit" ? "Visit" : "Entry"} removed` : c.action === "create" ? "Added afterwards" : `${FIELD_LABEL[c.field ?? ""] ?? c.field}: ${showValue(data, c.field, c.from)} → ${showValue(data, c.field, c.to)}`}
            </span>
            <span className="text-muted">
              {c.reason ? `“${c.reason}” · ` : ""}changed {new Date(c.at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
