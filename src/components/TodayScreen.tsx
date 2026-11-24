"use client";

import { useState } from "react";
import { statusNow, type DayStatus } from "@/lib/care/attendance";
import { endNap, openNap } from "@/lib/care/entries";
import { personName } from "@/lib/care/labels";
import { apply, useCareData } from "@/lib/care/store";
import { careDateOf, formatClock, formatClockTime, formatDate, formatDuration } from "@/lib/care/time";
import type { EntryType, Visit } from "@/lib/care/types";
import { CorrectVisitSheet, DropOffSheet, PastVisitSheet, PickUpSheet } from "./AttendanceSheets";
import { DayReport } from "./DayReport";
import { EntrySheet, TYPE_TINT } from "./EntrySheet";
import { Button, cx, Icon } from "./ui";

type Open = { kind: "drop" } | { kind: "pick"; visit: Visit } | { kind: "fix"; visit: Visit } | { kind: "entry"; type?: EntryType } | { kind: "past" } | null;

const QUICK: EntryType[] = ["meal", "nap", "activity", "note"];

export function TodayScreen({ now, onToast, onGoSettings }: { now: Date; onToast: (m: string) => void; onGoSettings: () => void }) {
  const data = useCareData();
  const status = statusNow(data, now);
  const [open, setOpen] = useState<Open>(null);
  const today = careDateOf(now);
  const reportDate = status.kind === "in" || status.kind === "fix" ? status.visit.careDate : today;
  const nap = openNap(data);
  const close = () => setOpen(null);
  const done = (m: string) => {
    setOpen(null);
    onToast(m);
  };
  const lastBackup = data.settings.lastBackupAt;
  const backupDue = data.visits.length > 0 && (!lastBackup || now.getTime() - Date.parse(lastBackup) > data.settings.backupReminderDays * 86_400_000);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">{formatDate(today)}</p>
        <h1 className="display text-[1.9rem]">{greeting(now)}</h1>
      </header>

      <StatusCard status={status} childName={data.child?.name ?? ""} sitter={status.kind !== "waiting" ? personName(data, status.visit.babysitterId) : undefined} />

      <div className="grid grid-cols-2 gap-3">
        {status.kind === "fix" ? (
          <Button className="col-span-2 min-h-16 rounded-[22px] bg-st-fix text-lg text-on-status hover:brightness-110" onClick={() => setOpen({ kind: "fix", visit: status.visit })}>
            Fix this visit
          </Button>
        ) : (
          <>
            <Button
              className="min-h-20 rounded-[22px] bg-st-in text-lg text-on-status hover:brightness-110"
              disabled={status.kind === "in"}
              onClick={() => setOpen({ kind: "drop" })}
              aria-describedby={status.kind === "in" ? "drop-hint" : undefined}
            >
              Dropped off
            </Button>
            <Button className="min-h-20 rounded-[22px] bg-st-out text-lg text-on-status hover:brightness-110" disabled={status.kind !== "in"} onClick={() => status.kind === "in" && setOpen({ kind: "pick", visit: status.visit })}>
              Picked up
            </Button>
            {status.kind === "in" && (
              <p id="drop-hint" className="col-span-2 -mt-1 text-center text-xs text-muted">
                Record the pickup before another drop-off.
              </p>
            )}
          </>
        )}
      </div>

      {nap && (
        <div className="flex items-center justify-between gap-3 rounded-[22px] bg-st-out-soft px-4 py-3">
          <span className="text-sm">
            <b>Napping</b> since {formatClock(nap.at)} · {formatDuration((now.getTime() - Date.parse(nap.at)) / 60_000)}
          </span>
          <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => onToast(apply((d) => endNap(d, nap.id, new Date().toISOString(), new Date())) ?? "Woke up")}>
            Woke up now
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="add-h">
        <div className="flex items-center justify-between">
          <h2 id="add-h" className="display text-xl">
            Add to the day
          </h2>
          <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setOpen({ kind: "entry" })}>
            <Icon name="plus" size={16} /> More
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((t) => (
            <button key={t} type="button" onClick={() => setOpen({ kind: "entry", type: t })} className="flex flex-col items-center gap-1.5 rounded-[20px] border border-line bg-surface px-1 py-3 text-xs font-semibold transition hover:border-accent">
              <span className={cx("grid h-10 w-10 place-items-center rounded-full", TYPE_TINT[t])}>
                <Icon name={t} />
              </span>
              {t === "activity" ? "Play" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {backupDue && (
        <button type="button" onClick={onGoSettings} className="flex items-center gap-3 rounded-[22px] bg-peach-soft px-4 py-3 text-left text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-peach" aria-hidden />
          <span>
            <b>Time for a backup.</b> {lastBackup ? `Last one was ${formatDate(careDateOf(lastBackup), { year: false })}.` : "You haven't made one yet."} Your records only live on this phone. Tap to back up.
          </span>
        </button>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="day-h">
        <h2 id="day-h" className="display text-xl">
          {reportDate === today ? "Today so far" : `Since ${formatDate(reportDate, { year: false })}`}
        </h2>
        <DayReport date={reportDate} now={now} onToast={onToast} />
        <button type="button" onClick={() => setOpen({ kind: "past" })} className="self-start text-sm font-semibold text-accent hover:underline">
          Forgot to record a visit? Add it
        </button>
      </section>

      {open?.kind === "drop" && <DropOffSheet onClose={close} onDone={done} />}
      {open?.kind === "pick" && <PickUpSheet visit={open.visit} onClose={close} onDone={done} />}
      {open?.kind === "fix" && <CorrectVisitSheet visit={open.visit} onClose={close} onDone={done} />}
      {open?.kind === "entry" && <EntrySheet date={reportDate} initialType={open.type} onClose={close} onDone={done} />}
      {open?.kind === "past" && <PastVisitSheet date={today} onClose={close} onDone={done} />}
    </div>
  );
}

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", hourCycle: "h23" }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const STATUS_STYLE: Record<DayStatus["kind"], { box: string; dot: string; label: string }> = {
  waiting: { box: "border-st-wait bg-st-wait-soft", dot: "bg-st-wait", label: "Not dropped off yet" },
  in: { box: "border-st-in bg-st-in-soft", dot: "bg-st-in animate-beat", label: "At the babysitter's" },
  out: { box: "border-st-out bg-st-out-soft", dot: "bg-st-out", label: "Picked up" },
  fix: { box: "border-st-fix bg-st-fix-soft border-dashed", dot: "bg-st-fix", label: "Needs a correction" },
};

function StatusCard({ status, childName, sitter }: { status: DayStatus; childName: string; sitter?: string }) {
  const s = STATUS_STYLE[status.kind];
  return (
    <section key={status.kind} className={cx("animate-pop flex flex-col gap-2 rounded-[26px] border-2 p-5", s.box)} aria-live="polite" data-status={status.kind}>
      <span className="flex items-center gap-2.5 text-sm font-semibold">
        <span className={cx("h-3 w-3 rounded-full", s.dot)} aria-hidden />
        {childName}
      </span>
      <p className="display text-[1.7rem]">{s.label}</p>
      <p className="figure text-[0.95rem]">
        {status.kind === "waiting" && (status.expected ? `Usual drop-off ${formatClockTime(status.expected)}` : "No care planned today")}
        {status.kind === "in" && `Since ${formatClock(status.visit.droppedOffAt)} · ${formatDuration(status.minutes)} so far · with ${sitter}`}
        {status.kind === "out" && `${formatClock(status.visit.droppedOffAt)} to ${formatClock(status.visit.pickedUpAt!)} · ${formatDuration(status.totalMinutes)} today`}
        {status.kind === "fix" && status.problem}
      </p>
    </section>
  );
}
