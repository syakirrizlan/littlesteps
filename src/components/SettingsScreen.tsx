"use client";

import { useRef, useState, type ReactNode } from "react";
import { toCsv } from "@/lib/care/export";
import { apply, replaceAll, useCareData } from "@/lib/care/store";
import { addMedInstruction, addPerson, renamePerson, setChild, setGraceMinutes, setMedInstructionActive, setPersonArchived, setSchedule } from "@/lib/care/setup";
import { careDateOf, formatDate } from "@/lib/care/time";
import type { CareData, PersonRole } from "@/lib/care/types";
import { saveFile } from "@/lib/files";
import { isStandalone, promptInstall, useCanInstall } from "@/lib/pwa";
import { AUTO_LOCK_CHOICES, setAutoLockMinutes, useAutoLockMinutes } from "@/lib/security/autolock";
import { changePasscode, eraseEverything, lock, makeBackup, NotABackupError, passcodeProblem, readBackup, storedSize, WrongPasscodeError } from "@/lib/security/vault";
import { Button, Card, cx, ErrorText, Field, inputClass } from "./ui";

const DAYS = [
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
  { n: 6, label: "Saturday" },
  { n: 0, label: "Sunday" },
];

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <Card>
      <h2 id={id} className="display mb-4 text-xl">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function Note({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p role="status" className={cx("rounded-2xl px-4 py-3 text-sm font-medium", ok ? "bg-st-in-soft text-st-in" : "bg-danger-soft text-danger")}>
      {children}
    </p>
  );
}

export function SettingsScreen({ onToast }: { onToast: (m: string) => void }) {
  const data = useCareData();
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="display text-[1.9rem]">Your diary</h1>
      </header>
      <BackupSection data={data} onToast={onToast} />
      <ChildSection data={data} onToast={onToast} />
      <PeopleSection data={data} role="family" title="Family" />
      <PeopleSection data={data} role="babysitter" title="Babysitters" />
      <ScheduleSection data={data} />
      <MedicineSection data={data} onToast={onToast} />
      <SecuritySection onToast={onToast} />
      <InstallSection />
      <EraseSection />
      <p className="px-2 text-center text-xs leading-relaxed text-muted">LittleSteps keeps everything encrypted on this phone. Nothing is sent anywhere. No accounts, ads, tracking or AI.</p>
    </div>
  );
}

function ChildSection({ data, onToast }: { data: CareData; onToast: (m: string) => void }) {
  const [name, setName] = useState(data.child?.name ?? "");
  const [birth, setBirth] = useState(data.child?.birthDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const err = apply((d) => setChild(d, { name, birthDate: birth || undefined }));
    setError(err);
    if (!err) onToast("Saved");
  };
  return (
    <Section title="Child" id="s-child">
      <Field label="Name" htmlFor="s-child-name">
        <input id="s-child-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Birth date (optional)" htmlFor="s-child-birth">
        <input id="s-child-birth" type="date" className={inputClass} value={birth} onChange={(e) => setBirth(e.target.value)} max={careDateOf(new Date())} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button variant="secondary" className="self-start" onClick={save}>
        Save
      </Button>
    </Section>
  );
}

function PeopleSection({ data, role, title }: { data: CareData; role: PersonRole; title: string }) {
  const people = data.people.filter((p) => p.role === role);
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCount = people.filter((p) => !p.archived).length;
  const add = () => {
    let err: string | null = null;
    apply((d) => {
      const r = addPerson(d, adding, role);
      if (!r.ok) {
        err = r.error;
        return r;
      }
      return { ok: true, data: r.data.data };
    });
    setError(err);
    if (!err) setAdding("");
  };
  return (
    <Section title={title} id={`s-${role}`}>
      <ul className="flex flex-col divide-y divide-line">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            {editing?.id === p.id ? (
              <span className="flex w-full gap-2">
                <input aria-label={`New name for ${p.name}`} className={inputClass} value={editing.name} onChange={(e) => setEditing({ id: p.id, name: e.target.value })} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const err = apply((d) => renamePerson(d, p.id, editing.name));
                    setError(err);
                    if (!err) setEditing(null);
                  }}
                >
                  Save
                </Button>
              </span>
            ) : (
              <>
                <span className={cx("font-semibold", p.archived && "text-muted line-through")}>{p.name}</span>
                <span className="flex gap-1">
                  <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setEditing({ id: p.id, name: p.name })}>
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-10 px-3 text-sm"
                    disabled={!p.archived && activeCount <= 1}
                    title={!p.archived && activeCount <= 1 ? "Keep at least one" : undefined}
                    onClick={() => apply((d) => setPersonArchived(d, p.id, !p.archived))}
                  >
                    {p.archived ? "Restore" : "Hide"}
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input aria-label={`Add ${role === "family" ? "a family member" : "a babysitter"}`} placeholder={role === "family" ? "Add a family member" : "Add a babysitter"} className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)} />
        <Button variant="secondary" onClick={add} disabled={!adding.trim()}>
          Add
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      <p className="text-xs text-muted">Hidden people stay in past records but aren&apos;t offered when you record a new visit.</p>
    </Section>
  );
}

function ScheduleSection({ data }: { data: CareData }) {
  const [error, setError] = useState<string | null>(null);
  const [grace, setGrace] = useState(String(data.settings.graceMinutes));
  return (
    <Section title="Usual times" id="s-times">
      <p className="-mt-2 text-sm text-muted">Used to flag a late drop-off or an early pickup. Leave a day empty if she doesn&apos;t usually go.</p>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-xs font-semibold text-muted sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]" aria-hidden>
        <span />
        <span>Drop-off</span>
        <span>Pickup</span>
      </div>
      <div className="flex flex-col gap-2">
        {DAYS.map((d) => {
          const s = data.schedule.find((x) => x.weekday === d.n);
          return (
            <div key={d.n} className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="text-sm font-semibold">
                <span className="sm:hidden">{d.label.slice(0, 3)}</span>
                <span className="hidden sm:inline">{d.label}</span>
              </span>
              <input
                type="time"
                aria-label={`${d.label} usual drop-off`}
                className={cx(inputClass, "time-compact min-w-0 px-2")}
                value={s?.dropOff ?? ""}
                onChange={(e) => setError(apply((x) => setSchedule(x, d.n, { dropOff: e.target.value || undefined, pickUp: s?.pickUp })))}
              />
              <input
                type="time"
                aria-label={`${d.label} usual pickup`}
                className={cx(inputClass, "time-compact min-w-0 px-2")}
                value={s?.pickUp ?? ""}
                onChange={(e) => setError(apply((x) => setSchedule(x, d.n, { dropOff: s?.dropOff, pickUp: e.target.value || undefined })))}
              />
            </div>
          );
        })}
      </div>
      <Field label="Grace period (minutes)" htmlFor="s-grace" hint="How far past the usual time before it counts as late or early.">
        <input
          id="s-grace"
          inputMode="numeric"
          className={cx(inputClass, "max-w-32")}
          value={grace}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setGrace(v);
            if (v) setError(apply((x) => setGraceMinutes(x, Number(v))));
          }}
        />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Section>
  );
}

function MedicineSection({ data, onToast }: { data: CareData; onToast: (m: string) => void }) {
  const [medicine, setMedicine] = useState("");
  const [dose, setDose] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const err = apply((d) => addMedInstruction(d, { medicine, dose, when, notes }, new Date()));
    setError(err);
    if (!err) {
      setMedicine("");
      setDose("");
      setWhen("");
      setNotes("");
      onToast("Medicine instruction added");
    }
  };
  return (
    <Section title="Medicine instructions" id="s-meds">
      <p className="-mt-2 text-sm text-muted">Medicine you have authorised the babysitter to give. Only these can be recorded as given.</p>
      {data.medInstructions.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {data.medInstructions.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
              <span className={cx("flex flex-col text-sm", !m.active && "text-muted")}>
                <b>{m.medicine}</b>
                <span>
                  {m.dose} · {m.when}
                  {m.notes ? ` · ${m.notes}` : ""}
                </span>
                {!m.active && <span className="text-xs">No longer authorised</span>}
              </span>
              <Button variant="ghost" className="min-h-10 shrink-0 px-3 text-sm" onClick={() => apply((d) => setMedInstructionActive(d, m.id, !m.active))}>
                {m.active ? "Stop" : "Allow again"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Medicine" htmlFor="m-name">
          <input id="m-name" className={inputClass} value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Paracetamol syrup" />
        </Field>
        <Field label="Dose" htmlFor="m-dose">
          <input id="m-dose" className={inputClass} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="5 ml" />
        </Field>
        <Field label="When it may be given" htmlFor="m-when">
          <input id="m-when" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="If temperature is 38 °C or more" />
        </Field>
        <Field label="Notes (optional)" htmlFor="m-notes">
          <input id="m-notes" className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="At most every 6 hours" />
        </Field>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button variant="secondary" className="self-start" onClick={add}>
        Add instruction
      </Button>
    </Section>
  );
}

export function BackupSection({ data, onToast, restoreOnly = false }: { data: CareData; onToast: (m: string) => void; restoreOnly?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [restore, setRestore] = useState<{ text: string; name: string } | null>(null);
  const [pass, setPass] = useState("");
  const [preview, setPreview] = useState<{ data: CareData; createdAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function backup() {
    setBusy(true);
    try {
      const now = new Date();
      const content = await makeBackup(now);
      const r = await saveFile(`littlesteps-backup-${careDateOf(now)}.littlesteps`, content, "application/octet-stream");
      if (r === "cancelled") return;
      apply((d) => ({ ok: true, data: { ...d, settings: { ...d.settings, lastBackupAt: now.toISOString() } } }));
      setMsg({ ok: true, text: "Backup saved. It's encrypted with your current passcode. Keep it somewhere safe, like Google Drive or your laptop." });
    } catch {
      setMsg({ ok: false, text: "Couldn't make the backup. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const r = await saveFile(`littlesteps-records-${careDateOf(new Date())}.csv`, toCsv(data), "text/csv");
    if (r !== "cancelled") setMsg({ ok: true, text: "Spreadsheet saved. Unlike a backup, it isn't encrypted, so keep the file private." });
  }

  async function open() {
    if (!restore) return;
    setBusy(true);
    try {
      setPreview(await readBackup(restore.text, pass));
      setMsg(null);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof WrongPasscodeError || err instanceof NotABackupError ? err.message : "Couldn't open that file." });
    } finally {
      setBusy(false);
    }
  }

  function confirmRestore() {
    if (!preview) return;
    replaceAll({ ...preview.data, settings: { ...preview.data.settings, lastBackupAt: preview.createdAt } });
    setRestore(null);
    setPreview(null);
    setPass("");
    setMsg({ ok: true, text: "Backup restored." });
    onToast("Backup restored");
  }

  return (
    <Section title={restoreOnly ? "Restore a backup" : "Backup"} id="s-backup">
      {restoreOnly ? (
        <p className="-mt-2 text-sm text-muted">Moving to a new phone? Open the backup file you saved from LittleSteps.</p>
      ) : (
        <p className="-mt-2 text-sm text-muted">
          Your records live only on this phone. A backup file lets you recover them if the phone is lost or the browser data is cleared.{" "}
          {data.settings.lastBackupAt ? `Last backup: ${formatDate(careDateOf(data.settings.lastBackupAt))}.` : "No backup yet."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!restoreOnly && (
          <Button onClick={backup} disabled={busy}>
            Download backup
          </Button>
        )}
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Restore from backup…
        </Button>
        {!restoreOnly && (
          <Button variant="ghost" onClick={exportCsv}>
            Export spreadsheet (CSV)
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".littlesteps,application/octet-stream,application/json"
        className="hidden"
        aria-label="Backup file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 20_000_000) return setMsg({ ok: false, text: "That file is too big to be a LittleSteps backup." });
          setRestore({ text: await f.text(), name: f.name });
          setPreview(null);
          setPass("");
          setMsg(null);
        }}
      />
      {restore && !preview && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
          <p className="text-sm">
            Opening <b className="break-all">{restore.name}</b>. Enter the passcode you had when you made this backup.
          </p>
          <input type="password" aria-label="Passcode for this backup" className={inputClass} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
          <div className="flex gap-2">
            <Button onClick={open} disabled={!pass || busy}>
              {busy ? "Opening…" : "Open backup"}
            </Button>
            <Button variant="ghost" onClick={() => setRestore(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {preview && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-st-fix bg-st-fix-soft p-4 text-sm">
          <p>
            This backup from <b>{formatDate(careDateOf(preview.createdAt))}</b> has {preview.data.visits.filter((v) => !v.voided).length} visits and {preview.data.entries.filter((x) => !x.voided).length} entries for {preview.data.child?.name ?? "your child"}.
          </p>
          <p>
            <b>Restoring replaces everything currently on this phone</b> ({data.visits.filter((v) => !v.voided).length} visits). It keeps your current passcode.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmRestore}>
              Replace with backup
            </Button>
            <Button variant="ghost" onClick={() => { setPreview(null); setRestore(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {msg && <Note ok={msg.ok}>{msg.text}</Note>}
      {!restoreOnly && <p className="text-xs text-muted">The diary uses {Math.max(1, Math.round(storedSize() / 1024))} KB on this phone. Browsers allow about 5 MB; a busy year takes about 0.3 MB.</p>}
    </Section>
  );
}

function SecuritySection({ onToast }: { onToast: (m: string) => void }) {
  const minutes = useAutoLockMinutes();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function change() {
    setBusy(true);
    try {
      await changePasscode(cur, next);
      setCur("");
      setNext("");
      setMsg({ ok: true, text: "Passcode changed. Older backups still open with the passcode you had when you made them." });
      onToast("Passcode changed");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't change the passcode." });
    } finally {
      setBusy(false);
    }
  }
  const problem = next ? passcodeProblem(next) : null;
  return (
    <Section title="Lock" id="s-lock">
      <Field label="Lock automatically after" htmlFor="s-autolock">
        <select id="s-autolock" className={inputClass} value={minutes} onChange={(e) => setAutoLockMinutes(Number(e.target.value))}>
          {AUTO_LOCK_CHOICES.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "Only when the app is closed" : m === 1 ? "1 minute" : `${m} minutes`}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="secondary" className="self-start" onClick={lock}>
        Lock now
      </Button>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="font-semibold">Change passcode</h3>
        <input type="password" aria-label="Current passcode" placeholder="Current passcode" className={inputClass} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <input type="password" aria-label="New passcode" placeholder="New passcode" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        {problem && <p className="text-xs text-danger">{problem}</p>}
        <Button variant="secondary" className="self-start" onClick={change} disabled={!cur || !next || !!problem || busy}>
          {busy ? "Changing…" : "Change passcode"}
        </Button>
        {msg && <Note ok={msg.ok}>{msg.text}</Note>}
      </div>
    </Section>
  );
}

function InstallSection() {
  const canInstall = useCanInstall();
  const ios = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (typeof window !== "undefined" && isStandalone()) return null;
  return (
    <Section title="Install on your phone" id="s-install">
      {canInstall ? (
        <Button className="self-start" onClick={() => void promptInstall()}>
          Install LittleSteps
        </Button>
      ) : ios ? (
        <p className="text-sm text-muted">In Safari, tap the Share button, then “Add to Home Screen”. On iPhone, keep using it from the Home Screen icon: Safari can clear data of websites you don&apos;t visit for a while, but not of Home Screen apps.</p>
      ) : (
        <p className="text-sm text-muted">In Chrome, open the ⋮ menu and choose “Install app” or “Add to Home screen”.</p>
      )}
    </Section>
  );
}

function EraseSection() {
  const [typed, setTyped] = useState("");
  return (
    <Section title="Erase this diary" id="s-erase">
      <p className="-mt-2 text-sm text-muted">Deletes every record from this phone. Make a backup first if you might need them. Type ERASE to confirm.</p>
      <div className="flex gap-2">
        <input aria-label="Type ERASE to confirm" className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
        <Button variant="danger" disabled={typed !== "ERASE"} onClick={eraseEverything}>
          Erase
        </Button>
      </div>
    </Section>
  );
}
