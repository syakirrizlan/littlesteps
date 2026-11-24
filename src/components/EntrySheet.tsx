"use client";

import { useState } from "react";
import { addEntry, updateEntry, voidEntry, type EntryDraft } from "@/lib/care/entries";
import { ACTIVITY_LABEL, AMOUNT_LABEL, CONDITION_LABEL, ENTRY_LABEL, MEAL_LABEL, SEVERITY_LABEL } from "@/lib/care/labels";
import { apply, useCareData } from "@/lib/care/store";
import { careDateOf, fromLocal } from "@/lib/care/time";
import type { ActivityKind, AmountEaten, Condition, Entry, EntryType, IncidentSeverity, MealKind } from "@/lib/care/types";
import { ReasonField, WhenInputs } from "./AttendanceSheets";
import { Button, Choice, cx, ErrorText, Field, Icon, inputClass, Sheet } from "./ui";

const TYPES: EntryType[] = ["meal", "nap", "activity", "health", "medication", "incident", "note"];
const opts = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/** Default time for a new entry: now for today, midday for an earlier day. */
function defaultAt(date: string): string {
  const now = new Date();
  return careDateOf(now) === date ? now.toISOString() : fromLocal(date, "12:00");
}

export function EntrySheet({ date, entry, initialType, onClose, onDone }: { date: string; entry?: Entry; initialType?: EntryType; onClose: () => void; onDone: (msg: string) => void }) {
  const data = useCareData();
  const [type, setType] = useState<EntryType | undefined>(entry?.type ?? initialType);
  const [at, setAt] = useState(entry?.at ?? defaultAt(date));
  const [detail, setDetail] = useState(entry?.detail ?? "");
  // meal
  const [meal, setMeal] = useState<MealKind | undefined>(entry?.type === "meal" ? entry.meal : undefined);
  const [food, setFood] = useState(entry?.type === "meal" ? (entry.food ?? "") : "");
  const [amount, setAmount] = useState<AmountEaten | undefined>(entry?.type === "meal" ? entry.amount : undefined);
  const [ml, setMl] = useState(entry?.type === "meal" && entry.ml ? String(entry.ml) : "");
  // nap
  const [asleep, setAsleep] = useState(entry?.type === "nap" ? !entry.end : false);
  const [end, setEnd] = useState(entry?.type === "nap" && entry.end ? entry.end : at);
  // activity / health / medicine / incident
  const [kind, setKind] = useState<ActivityKind | undefined>(entry?.type === "activity" ? entry.kind : undefined);
  const [condition, setCondition] = useState<Condition | undefined>(entry?.type === "health" ? entry.condition : undefined);
  const [temp, setTemp] = useState(entry?.type === "health" && entry.temperatureTenths ? (entry.temperatureTenths / 10).toFixed(1) : "");
  const meds = data.medInstructions.filter((m) => m.active || (entry?.type === "medication" && entry.instructionId === m.id));
  const [instructionId, setInstructionId] = useState<string | undefined>(entry?.type === "medication" ? entry.instructionId : meds[0]?.id);
  const [dose, setDose] = useState(entry?.type === "medication" ? entry.dose : (meds[0]?.dose ?? ""));
  const [severity, setSeverity] = useState<IncidentSeverity | undefined>(entry?.type === "incident" ? entry.severity : undefined);
  const [action, setAction] = useState(entry?.type === "incident" ? (entry.actionTaken ?? "") : "");
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const showDate = careDateOf(at) !== date || careDateOf(new Date()) !== date;

  function draft(): EntryDraft | string {
    const d = detail.trim() || undefined;
    switch (type) {
      case undefined:
        return "Choose what to record.";
      case "meal": {
        if (!meal) return "Choose which meal.";
        if (!amount) return "Choose how much she ate.";
        const mlNum = ml.trim() ? Number(ml) : undefined;
        return { type, at, meal, amount, food: food.trim() || undefined, ml: meal === "milk" ? mlNum : undefined, detail: d };
      }
      case "nap":
        return { type, at, end: asleep ? undefined : end, detail: d };
      case "activity":
        return kind ? { type, at, kind, detail: d } : "Choose an activity.";
      case "health": {
        if (!condition) return "Choose how she was.";
        const t = temp.trim() ? Math.round(Number(temp.replace(",", ".")) * 10) : undefined;
        if (t !== undefined && Number.isNaN(t)) return "Temperature should be a number like 37.5.";
        return { type, at, condition, temperatureTenths: t, detail: d };
      }
      case "medication":
        return { type, at, instructionId: instructionId ?? "", dose, detail: d };
      case "incident":
        return severity ? { type, at, severity, detail: detail.trim(), actionTaken: action.trim() || undefined } : "Choose how serious it was.";
      case "note":
        return { type, at, detail: detail.trim() };
    }
  }

  function save() {
    if (removing && entry) {
      const err = apply((x) => voidEntry(x, entry.id, reason, new Date()));
      return err ? setError(err) : onDone("Removed");
    }
    const dr = draft();
    if (typeof dr === "string") return setError(dr);
    const err = apply((x) => (entry ? updateEntry(x, entry.id, dr, new Date(), reason) : addEntry(x, dr, new Date())));
    if (err) return setError(err);
    onDone(entry ? "Saved" : `${ENTRY_LABEL[dr.type]} added`);
  }

  if (!type) {
    return (
      <Sheet title="Add to the day" onClose={onClose}>
        <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t} type="button" data-autofocus={t === "meal" || undefined} onClick={() => setType(t)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-left font-semibold transition hover:border-accent hover:text-accent">
              <span className={cx("grid h-9 w-9 place-items-center rounded-full", TYPE_TINT[t])}>
                <Icon name={t} />
              </span>
              {ENTRY_LABEL[t]}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={removing ? "Remove entry" : `${entry ? "Edit" : "Add"} ${ENTRY_LABEL[type].toLowerCase()}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant={removing ? "danger" : "primary"} className="w-full" onClick={save}>
            {removing ? "Remove" : "Save"}
          </Button>
          {entry && (
            <Button variant="ghost" className="w-full" onClick={() => { setRemoving((r) => !r); setError(null); }}>
              {removing ? "Back to editing" : "Remove this entry…"}
            </Button>
          )}
        </div>
      }
    >
      {removing ? (
        <ReasonField value={reason} onChange={setReason} />
      ) : (
        <>
          {type === "nap" ? (
            <>
              <WhenInputs id="e-at" label="Fell asleep" value={at} onChange={setAt} showDate={showDate} />
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line-strong px-4 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={asleep} onChange={(e) => setAsleep(e.target.checked)} />
                Still asleep
              </label>
              {!asleep && <WhenInputs id="e-end" label="Woke up" value={end} onChange={setEnd} showDate={showDate || careDateOf(end) !== careDateOf(at)} />}
            </>
          ) : (
            <WhenInputs id="e-at" label="Time" value={at} onChange={setAt} showDate={showDate} />
          )}

          {type === "meal" && (
            <>
              <Choice label="Meal" value={meal} options={opts(MEAL_LABEL)} onChange={setMeal} columns={3} />
              {meal === "milk" ? (
                <Field label="Millilitres (optional)" htmlFor="e-ml">
                  <input id="e-ml" inputMode="numeric" pattern="[0-9]*" className={inputClass} value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))} placeholder="150" />
                </Field>
              ) : (
                <Field label="Food (optional)" htmlFor="e-food">
                  <input id="e-food" className={inputClass} value={food} onChange={(e) => setFood(e.target.value)} placeholder="Rice, chicken, carrots" maxLength={120} />
                </Field>
              )}
              <Choice label="How much" value={amount} options={opts(AMOUNT_LABEL)} onChange={setAmount} columns={3} />
            </>
          )}
          {type === "activity" && <Choice label="Activity" value={kind} options={opts(ACTIVITY_LABEL)} onChange={setKind} columns={3} />}
          {type === "health" && (
            <>
              <Choice label="How was she" value={condition} options={opts(CONDITION_LABEL)} onChange={setCondition} columns={3} />
              <Field label="Temperature °C (optional)" htmlFor="e-temp">
                <input id="e-temp" inputMode="decimal" className={inputClass} value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="37.2" />
              </Field>
            </>
          )}
          {type === "medication" &&
            (meds.length === 0 ? (
              <p className="rounded-2xl bg-st-fix-soft px-4 py-3 text-sm text-st-fix">Add the medicine and dose you authorise in Settings → Medicine instructions first. Only authorised medicine can be recorded.</p>
            ) : (
              <>
                <Choice
                  label="Medicine (authorised by you)"
                  value={instructionId}
                  options={meds.map((m) => ({ value: m.id, label: m.medicine }))}
                  onChange={(v) => {
                    setInstructionId(v);
                    setDose(meds.find((m) => m.id === v)?.dose ?? "");
                  }}
                  columns={Math.min(meds.length, 2)}
                />
                {(() => {
                  const m = meds.find((x) => x.id === instructionId);
                  return m ? <p className="-mt-2 text-xs text-muted">Your instruction: {m.dose}, {m.when}{m.notes ? `. ${m.notes}` : ""}</p> : null;
                })()}
                <Field label="Dose given" htmlFor="e-dose">
                  <input id="e-dose" className={inputClass} value={dose} onChange={(e) => setDose(e.target.value)} maxLength={60} />
                </Field>
              </>
            ))}
          {type === "incident" && <Choice label="How serious" value={severity} options={opts(SEVERITY_LABEL)} onChange={setSeverity} columns={3} />}

          <Field label={type === "incident" ? "What happened" : type === "note" ? "Note" : "Notes (optional)"} htmlFor="e-detail">
            <textarea id="e-detail" rows={3} className={cx(inputClass, "resize-none")} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
          </Field>
          {type === "incident" && (
            <Field label="Action taken (optional)" htmlFor="e-action">
              <input id="e-action" className={inputClass} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Cold pack, cuddles" maxLength={500} />
            </Field>
          )}
          {entry && <ReasonField label="Reason for the change (optional)" value={reason} onChange={setReason} />}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

export const TYPE_TINT: Record<EntryType, string> = {
  meal: "bg-peach-soft text-peach-ink",
  nap: "bg-st-out-soft text-st-out",
  activity: "bg-st-in-soft text-st-in",
  health: "bg-accent-soft text-accent",
  medication: "bg-accent-soft text-accent",
  incident: "bg-st-fix-soft text-st-fix",
  note: "bg-surface-2 text-muted",
};
