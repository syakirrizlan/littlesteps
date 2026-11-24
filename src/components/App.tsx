"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apply, useCareData } from "@/lib/care/store";
import { addPerson, isSetUp, setChild, setSchedule } from "@/lib/care/setup";
import type { CareData, Result } from "@/lib/care/types";
import { startPwa } from "@/lib/pwa";
import { useAutoLock } from "@/lib/security/autolock";
import AppShell from "./AppShell";
import { Logo } from "./Logo";
import { BackupSection } from "./SettingsScreen";
import { Button, cx, ErrorText, Field, inputClass } from "./ui";

export default function App() {
  const data = useCareData();
  useAutoLock();
  useEffect(() => startPwa(), []);
  return isSetUp(data) ? <AppShell /> : <Onboarding data={data} />;
}

const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

/** First run: who's who and the usual times. Everything can be changed later in Settings. */
function Onboarding({ data }: { data: CareData }) {
  const [child, setChildName] = useState(data.child?.name ?? "");
  const [me, setMe] = useState("");
  const [other, setOther] = useState("");
  const [sitter, setSitter] = useState("");
  const [dropOffAt, setDropOffAt] = useState("08:00");
  const [pickUpAt, setPickUpAt] = useState("17:30");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!me.trim()) return setError("Enter your name.");
    if (!sitter.trim()) return setError("Enter the babysitter's name.");
    const err = apply((d) => {
      const steps: ((x: CareData) => Result)[] = [
        (x) => setChild(x, { name: child }),
        (x) => wrap(addPerson(x, me, "family")),
        (x) => (other.trim() ? wrap(addPerson(x, other, "family")) : { ok: true, data: x }),
        (x) => wrap(addPerson(x, sitter, "babysitter")),
        ...days.map((wd) => (x: CareData) => setSchedule(x, wd, { dropOff: dropOffAt || undefined, pickUp: pickUpAt || undefined })),
      ];
      let cur = d;
      for (const step of steps) {
        const r = step(cur);
        if (!r.ok) return r;
        cur = r.data;
      }
      return { ok: true, data: cur };
    });
    setError(err);
  }

  return (
    <main className="px-gutter pt-safe pb-safe mx-auto flex min-h-dvh max-w-lg flex-col gap-6 py-8">
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <span className="display text-lg">LittleSteps</span>
      </div>
      <div>
        <p className="eyebrow">Getting started</p>
        <h1 className="display mt-2 text-[2rem]">Who&apos;s who</h1>
        <p className="mt-2 text-muted">Names only, kept on this phone. You can change everything later in Settings.</p>
      </div>
      <form onSubmit={submit} className="animate-rise flex flex-col gap-4 rounded-[28px] border border-line bg-surface p-5 shadow-card" noValidate>
        <Field label="Your daughter's name" htmlFor="ob-child">
          <input id="ob-child" className={inputClass} value={child} onChange={(e) => setChildName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Your name" htmlFor="ob-me" hint="Shown as who dropped off or picked up.">
          <input id="ob-me" className={inputClass} value={me} onChange={(e) => setMe(e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Another family member (optional)" htmlFor="ob-other" hint="For example your spouse, if they sometimes do drop-off.">
          <input id="ob-other" className={inputClass} value={other} onChange={(e) => setOther(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Babysitter's name" htmlFor="ob-sitter">
          <input id="ob-sitter" className={inputClass} value={sitter} onChange={(e) => setSitter(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usual drop-off" htmlFor="ob-drop">
            <input id="ob-drop" type="time" className={inputClass} value={dropOffAt} onChange={(e) => setDropOffAt(e.target.value)} />
          </Field>
          <Field label="Usual pickup" htmlFor="ob-pick">
            <input id="ob-pick" type="time" className={inputClass} value={pickUpAt} onChange={(e) => setPickUpAt(e.target.value)} />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">On these days</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => {
              const on = days.includes(w.n);
              return (
                <label key={w.n} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-xs font-semibold has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-accent/30", on ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-muted")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setDays((ds) => (on ? ds.filter((x) => x !== w.n) : [...ds, w.n]))} />
                  {w.label}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted">Used to flag a late drop-off or an early pickup.</p>
        </fieldset>
        <ErrorText>{error}</ErrorText>
        <Button type="submit">Start the diary</Button>
      </form>
      <BackupSection data={data} onToast={() => {}} restoreOnly />
    </main>
  );
}

function wrap(r: Result<{ data: CareData; id: string }>): Result {
  return r.ok ? { ok: true, data: r.data.data } : r;
}
