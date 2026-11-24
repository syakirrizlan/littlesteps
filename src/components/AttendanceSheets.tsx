"use client";

import { useState } from "react";
import { addPastVisit, correctVisit, dropOff, liveVisits, pickUp, scheduleFor, voidVisit } from "@/lib/care/attendance";
import { apply, useCareData } from "@/lib/care/store";
import { activePeople } from "@/lib/care/setup";
import { careDateOf, clockOf, formatClock, formatDate, fromLocal } from "@/lib/care/time";
import type { CareData, Person, Visit } from "@/lib/care/types";
import { Button, Choice, ErrorText, Field, inputClass, Sheet } from "./ui";

/** Date + time pickers in Kuala Lumpur time. */
export function WhenInputs({ id, label, value, onChange, showDate = true }: { id: string; label: string; value: string; onChange: (iso: string) => void; showDate?: boolean }) {
  const date = careDateOf(value);
  const time = clockOf(value);
  const set = (d: string, t: string) => d && t && onChange(fromLocal(d, t));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className={showDate ? "grid grid-cols-[1.25fr_1fr] gap-2" : "grid grid-cols-1"}>
        {showDate && <input id={`${id}-date`} type="date" aria-label={`${label} date`} className={inputClass} value={date} onChange={(e) => set(e.target.value, time)} />}
        <input id={`${id}-time`} type="time" aria-label={`${label} time`} className={inputClass} value={time} onChange={(e) => set(date, e.target.value)} />
      </div>
    </fieldset>
  );
}

function peopleOptions(list: Person[]) {
  return list.map((p) => ({ value: p.id, label: p.name }));
}

/** The person who did the last drop-off or pickup, else the first family member. */
function lastPerson(data: CareData, field: "droppedOffBy" | "pickedUpBy" | "babysitterId", role: "family" | "babysitter"): string | undefined {
  const active = activePeople(data, role);
  const visits = liveVisits(data);
  for (let i = visits.length - 1; i >= 0; i--) {
    const id = visits[i][field];
    if (id && active.some((p) => p.id === id)) return id;
  }
  return active[0]?.id;
}

const cols = (n: number) => Math.min(Math.max(n, 1), 3);

export function DropOffSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const data = useCareData();
  const family = activePeople(data, "family");
  const sitters = activePeople(data, "babysitter");
  const [at, setAt] = useState(() => new Date().toISOString());
  const [by, setBy] = useState(() => lastPerson(data, "droppedOffBy", "family"));
  const [sitter, setSitter] = useState(() => lastPerson(data, "babysitterId", "babysitter"));
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const err = apply((d) => dropOff(d, { at, by: by ?? "", babysitterId: sitter ?? "" }, new Date()));
    if (err) return setError(err);
    onDone(`Dropped off at ${formatClock(at)}`);
  };
  return (
    <Sheet title="Dropped off" onClose={onClose} footer={<Button className="w-full bg-st-in text-on-status hover:brightness-110" onClick={save}>Save drop-off</Button>}>
      <WhenInputs id="drop" label="Time" value={at} onChange={setAt} showDate={false} />
      <Choice label="Dropped off by" value={by} options={peopleOptions(family)} onChange={setBy} columns={cols(family.length)} />
      {sitters.length > 1 && <Choice label="Babysitter" value={sitter} options={peopleOptions(sitters)} onChange={setSitter} columns={cols(sitters.length)} />}
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

export function PickUpSheet({ visit, onClose, onDone }: { visit: Visit; onClose: () => void; onDone: (msg: string) => void }) {
  const data = useCareData();
  const family = activePeople(data, "family");
  const [at, setAt] = useState(() => new Date().toISOString());
  const [by, setBy] = useState(() => lastPerson(data, "pickedUpBy", "family"));
  const [error, setError] = useState<string | null>(null);
  const crossesDay = careDateOf(at) !== visit.careDate || careDateOf(new Date()) !== visit.careDate;
  const save = () => {
    const err = apply((d) => pickUp(d, { at, by: by ?? "" }, new Date()));
    if (err) return setError(err);
    onDone(`Picked up at ${formatClock(at)}`);
  };
  return (
    <Sheet title="Picked up" onClose={onClose} footer={<Button className="w-full bg-st-out text-on-status hover:brightness-110" onClick={save}>Save pickup</Button>}>
      <p className="text-sm text-muted">Dropped off {formatDate(visit.careDate, { year: false })} at {formatClock(visit.droppedOffAt)}.</p>
      <WhenInputs id="pick" label="Time" value={at} onChange={setAt} showDate={crossesDay} />
      <Choice label="Picked up by" value={by} options={peopleOptions(family)} onChange={setBy} columns={cols(family.length)} />
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

export function ReasonField({ value, onChange, label = "Reason" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Field label={label} htmlFor="reason" hint="Kept in the day's change history.">
      <input id="reason" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder="For example: tapped late" autoComplete="off" maxLength={200} />
    </Field>
  );
}

/** Fix times or people on a visit, or remove it. Every change needs a reason. */
export function CorrectVisitSheet({ visit, onClose, onDone }: { visit: Visit; onClose: () => void; onDone: (msg: string) => void }) {
  const data = useCareData();
  const family = activePeople(data, "family");
  const sitters = activePeople(data, "babysitter");
  const withArchived = (list: Person[], id?: string) => (id && !list.some((p) => p.id === id) ? [...list, ...data.people.filter((p) => p.id === id)] : list);
  const [dropAt, setDropAt] = useState(visit.droppedOffAt);
  const [dropBy, setDropBy] = useState<string | undefined>(visit.droppedOffBy);
  const [hasPick, setHasPick] = useState(!!visit.pickedUpAt);
  const [pickAt, setPickAt] = useState(visit.pickedUpAt ?? fromLocal(visit.careDate, visit.expected.pickUp ?? clockOf(new Date())));
  const [pickBy, setPickBy] = useState<string | undefined>(visit.pickedUpBy ?? visit.droppedOffBy);
  const [sitter, setSitter] = useState<string | undefined>(visit.babysitterId);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const err = removing
      ? apply((d) => voidVisit(d, visit.id, reason, new Date()))
      : apply((d) =>
          correctVisit(d, visit.id, { droppedOffAt: dropAt, droppedOffBy: dropBy, babysitterId: sitter, pickedUpAt: hasPick ? pickAt : undefined, pickedUpBy: hasPick ? pickBy : undefined }, reason, new Date()),
        );
    if (err) return setError(err);
    onDone(removing ? "Visit removed" : "Correction saved");
  };

  return (
    <Sheet
      title={removing ? "Remove this visit" : "Correct visit"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant={removing ? "danger" : "primary"} className="w-full" onClick={save}>
            {removing ? "Remove visit" : "Save correction"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { setRemoving((r) => !r); setError(null); }}>
            {removing ? "Back to correcting" : "Remove this visit instead…"}
          </Button>
        </div>
      }
    >
      {removing ? (
        <p className="text-sm text-muted">The visit is taken out of reports and totals but stays in the change history with your reason.</p>
      ) : (
        <>
          <WhenInputs id="c-drop" label="Drop-off" value={dropAt} onChange={setDropAt} />
          <Choice label="Dropped off by" value={dropBy} options={peopleOptions(withArchived(family, dropBy))} onChange={setDropBy} columns={cols(family.length)} />
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line-strong px-4 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={hasPick} onChange={(e) => setHasPick(e.target.checked)} />
            She has been picked up
          </label>
          {hasPick && (
            <>
              <WhenInputs id="c-pick" label="Pickup" value={pickAt} onChange={setPickAt} />
              <Choice label="Picked up by" value={pickBy} options={peopleOptions(withArchived(family, pickBy))} onChange={setPickBy} columns={cols(family.length)} />
            </>
          )}
          {sitters.length + (sitters.some((s) => s.id === sitter) ? 0 : 1) > 1 && (
            <Choice label="Babysitter" value={sitter} options={peopleOptions(withArchived(sitters, sitter))} onChange={setSitter} columns={cols(sitters.length)} />
          )}
        </>
      )}
      <ReasonField value={reason} onChange={setReason} />
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

/** Record a whole visit after the fact. */
export function PastVisitSheet({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: (msg: string) => void }) {
  const data = useCareData();
  const family = activePeople(data, "family");
  const sitters = activePeople(data, "babysitter");
  const sch = scheduleFor(data, date);
  const [dropAt, setDropAt] = useState(fromLocal(date, sch?.dropOff ?? "08:00"));
  const [pickAt, setPickAt] = useState(fromLocal(date, sch?.pickUp ?? "17:00"));
  const [dropBy, setDropBy] = useState(() => lastPerson(data, "droppedOffBy", "family"));
  const [pickBy, setPickBy] = useState(() => lastPerson(data, "pickedUpBy", "family"));
  const [sitter, setSitter] = useState(() => lastPerson(data, "babysitterId", "babysitter"));
  const [reason, setReason] = useState("Forgot to record it");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const err = apply((d) => addPastVisit(d, { droppedOffAt: dropAt, droppedOffBy: dropBy ?? "", pickedUpAt: pickAt, pickedUpBy: pickBy ?? "", babysitterId: sitter ?? "" }, reason, new Date()));
    if (err) return setError(err);
    onDone("Visit added");
  };
  return (
    <Sheet title="Add a missed visit" onClose={onClose} footer={<Button className="w-full" onClick={save}>Add visit</Button>}>
      <WhenInputs id="p-drop" label="Drop-off" value={dropAt} onChange={setDropAt} />
      <Choice label="Dropped off by" value={dropBy} options={peopleOptions(family)} onChange={setDropBy} columns={cols(family.length)} />
      <WhenInputs id="p-pick" label="Pickup" value={pickAt} onChange={setPickAt} />
      <Choice label="Picked up by" value={pickBy} options={peopleOptions(family)} onChange={setPickBy} columns={cols(family.length)} />
      {sitters.length > 1 && <Choice label="Babysitter" value={sitter} options={peopleOptions(sitters)} onChange={setSitter} columns={cols(sitters.length)} />}
      <ReasonField value={reason} onChange={setReason} />
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}
