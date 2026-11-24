"use client";

import { useState } from "react";
import { monthSummary, type MonthDay } from "@/lib/care/report";
import { useCareData } from "@/lib/care/store";
import { addDays, addMonths, careDateOf, formatDate, formatDuration, formatMonth, monthOf, weekdayOf } from "@/lib/care/time";
import type { Route } from "@/lib/hooks";
import { PastVisitSheet } from "./AttendanceSheets";
import { DayReport, Pill } from "./DayReport";
import { EntrySheet } from "./EntrySheet";
import { Button, Card, cx, Icon } from "./ui";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Attendance history: one month at a time, with a calendar and the list of days. */
export function DaysScreen({ month, now, go }: { month?: string; now: Date; go: (r: Route, replace?: boolean) => void }) {
  const data = useCareData();
  const current = monthOf(careDateOf(now));
  const m = month && month <= current ? month : current;
  const sum = monthSummary(data, m, now);
  const lead = (weekdayOf(`${m}-01`) + 6) % 7;
  const maxMinutes = Math.max(600, ...sum.days.map((d) => d.minutes));
  const attended = sum.days.filter((d) => d.visits > 0).reverse();
  // Only point out missed usual days once the diary was in use.
  const firstVisit = data.visits.filter((v) => !v.voided).map((v) => v.careDate).sort()[0] ?? careDateOf(now);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:border-accent" onClick={() => go({ tab: "days", month: addMonths(m, -1) }, true)} aria-label="Previous month">
          <Icon name="chevron-left" />
        </button>
        <div className="text-center">
          <p className="eyebrow">Attendance</p>
          <h1 className="display text-[1.6rem]">{formatMonth(m)}</h1>
        </div>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:border-accent disabled:opacity-30" disabled={m >= current} onClick={() => go({ tab: "days", month: addMonths(m, 1) }, true)} aria-label="Next month">
          <Icon name="chevron-right" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Days at babysitter" value={String(sum.daysAttended)} />
        <Stat label="Total time" value={formatDuration(sum.totalMinutes)} />
        <Stat label="Average day" value={sum.daysAttended ? formatDuration(sum.averageMinutes) : "–"} />
        <Stat label="Late · early" value={`${sum.lateCount} · ${sum.earlyCount}`} />
      </div>

      <Card>
        <div className="grid grid-cols-7 gap-1.5 text-center" role="grid" aria-label={`Calendar for ${formatMonth(m)}`}>
          {WEEK.map((w) => (
            <span key={w} className="pb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted" role="columnheader">
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {sum.days.map((d) => (
            <CalendarDay key={d.date} d={d} max={maxMinutes} future={d.date > careDateOf(now)} tracked={d.date >= firstVisit} onOpen={() => go({ tab: "day", date: d.date })} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          <Legend className="bg-st-in">At babysitter (darker = longer)</Legend>
          <Legend className="bg-st-fix">Needs a fix</Legend>
          <Legend className="border-2 border-dashed border-line-strong bg-transparent">Usual day, no visit</Legend>
        </div>
      </Card>

      <section className="flex flex-col gap-2" aria-labelledby="list-h">
        <h2 id="list-h" className="display text-xl">
          Days
        </h2>
        {attended.length === 0 ? (
          <p className="rounded-[22px] border border-line bg-surface p-5 text-sm text-muted">No visits recorded in {formatMonth(m)}.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attended.map((d) => (
              <li key={d.date}>
                <button type="button" onClick={() => go({ tab: "day", date: d.date })} className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-line bg-surface px-4 py-3 text-left hover:border-accent">
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{formatDate(d.date, { year: false })}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {d.needsFix && <Pill tone="fix">Needs a fix</Pill>}
                      {d.late && <Pill tone="fix">Late</Pill>}
                      {d.early && <Pill tone="out">Early pickup</Pill>}
                      {d.incidents > 0 && <Pill tone="fix">Incident</Pill>}
                    </span>
                  </span>
                  <span className="figure shrink-0 font-semibold text-muted">{formatDuration(d.minutes)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3">
      <span className="figure display text-[1.4rem]">{value}</span>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-3 w-3 rounded", className)} aria-hidden />
      {children}
    </span>
  );
}

function CalendarDay({ d, max, future, tracked, onOpen }: { d: MonthDay; max: number; future: boolean; tracked: boolean; onOpen: () => void }) {
  const day = Number(d.date.slice(8));
  const strength = d.visits ? 0.3 + 0.7 * Math.min(1, d.minutes / max) : 0;
  const label = `${formatDate(d.date, { year: false })}: ${d.visits ? formatDuration(d.minutes) : "no visit"}${d.needsFix ? ", needs a fix" : ""}${d.late ? ", late drop-off" : ""}${d.early ? ", early pickup" : ""}`;
  return (
    <button
      type="button"
      role="gridcell"
      onClick={onOpen}
      disabled={future}
      aria-label={label}
      className={cx(
        "relative grid aspect-square place-items-center rounded-xl text-sm font-semibold transition disabled:opacity-35",
        d.needsFix ? "bg-st-fix text-on-status" : d.visits  ? "text-on-status" : d.scheduled && !future && tracked ? "border-2 border-dashed border-line-strong text-muted" : "text-muted",
      )}
      style={d.visits && !d.needsFix ? { background: `color-mix(in srgb, var(--st-in) ${Math.round(strength * 100)}%, var(--surface))` } : undefined}
    >
      <span className={d.visits && strength < 0.55 && !d.needsFix ? "text-foreground" : undefined}>{day}</span>
      {(d.late || d.early) && !d.needsFix && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-st-fix ring-2 ring-surface" aria-hidden />}
    </button>
  );
}

/** One day's full report, with arrows to the day before and after. */
export function DayScreen({ date, now, go, onToast }: { date: string; now: Date; go: (r: Route, replace?: boolean) => void; onToast: (m: string) => void }) {
  const today = careDateOf(now);
  const [open, setOpen] = useState<"entry" | "past" | null>(null);
  const done = (m: string) => {
    setOpen(null);
    onToast(m);
  };
  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => go({ tab: "days", month: monthOf(date) })} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-accent">
        <Icon name="chevron-left" size={16} /> {formatMonth(monthOf(date))}
      </button>
      <header className="flex items-center justify-between gap-2">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:border-accent" onClick={() => go({ tab: "day", date: addDays(date, -1) }, true)} aria-label="Day before">
          <Icon name="chevron-left" />
        </button>
        <div className="text-center">
          <p className="eyebrow">Daily report</p>
          <h1 className="display text-[1.5rem]">{formatDate(date)}</h1>
        </div>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:border-accent disabled:opacity-30" disabled={date >= today} onClick={() => go({ tab: "day", date: addDays(date, 1) }, true)} aria-label="Day after">
          <Icon name="chevron-right" />
        </button>
      </header>
      <DayReport date={date} now={now} onToast={onToast} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setOpen("entry")}>
          <Icon name="plus" size={16} /> Add to this day
        </Button>
        <Button variant="secondary" onClick={() => setOpen("past")}>
          Add a missed visit
        </Button>
      </div>
      {open === "entry" && <EntrySheet date={date} onClose={() => setOpen(null)} onDone={done} />}
      {open === "past" && <PastVisitSheet date={date} onClose={() => setOpen(null)} onDone={done} />}
    </div>
  );
}
