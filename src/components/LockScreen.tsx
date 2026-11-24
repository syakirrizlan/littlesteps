"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createVault, eraseEverything, lockoutRemaining, LockedOutError, passcodeProblem, unlock, VaultExistsError, WrongPasscodeError, type VaultStatus } from "@/lib/security/vault";
import { passcodeStrength } from "@/lib/security/crypto";
import { emptyCareData } from "@/lib/care/types";
import { Button, cx, inputClass } from "./ui";
import { InstallButton } from "./Install";
import { Logo } from "./Logo";

function PasscodeField({ id, label, value, onChange, autoFocus, autoComplete, invalid }: { id: string; label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          className={cx(inputClass, "pr-20", invalid && "!border-danger")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-foreground"
          aria-label={show ? "Hide passcode" : "Show passcode"}
          aria-pressed={show}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function SetupForm() {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = passcodeStrength(pass);
  const problem = pass ? passcodeProblem(pass) : null;
  const matches = pass.length > 0 && pass === confirm;
  const ok = !passcodeProblem(pass) && matches;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createVault(pass, emptyCareData());
    } catch (err) {
      if (err instanceof VaultExistsError) return;
      setError("Couldn't save on this phone. Check that the browser allows site storage (not a private tab), then try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <p className="eyebrow">Welcome</p>
        <h1 className="display mt-2 text-[2rem]">Create your passcode</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">Everything you record is encrypted on this phone with it. You&apos;ll enter it each time you open LittleSteps.</p>
      </div>
      <PasscodeField id="new-pass" label="Passcode" value={pass} onChange={setPass} autoFocus autoComplete="new-password" />
      <div className="-mt-2 flex flex-col gap-1.5" aria-live="polite">
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cx("h-1.5 flex-1 rounded-full transition-colors", strength.score >= n ? (strength.score === 1 ? "bg-peach" : strength.score === 2 ? "bg-butter" : "bg-st-in") : "bg-surface-2")} />
          ))}
        </div>
        <p className={cx("text-xs", problem ? "text-danger" : "text-muted")}>
          {problem ?? (pass ? `${strength.label}. ` : "")}
          {!problem && "At least 8 characters, not just numbers. A short phrase like “teh tarik at 7” is strong and easy to remember."}
        </p>
      </div>
      <PasscodeField id="confirm-pass" label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={confirm.length > 0 && !matches} />
      {confirm.length > 0 && !matches && <p className="-mt-3 text-xs font-medium text-danger">Passcodes don&apos;t match yet.</p>}
      <div className="flex gap-3 rounded-2xl bg-peach-soft px-4 py-3 text-sm">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-peach" aria-hidden />
        <p>
          <strong className="font-semibold">A forgotten passcode can&apos;t be recovered.</strong> Write it down somewhere safe, and make backups in Settings.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!ok || busy}>
        {busy ? "Encrypting…" : "Lock and continue"}
      </Button>
    </form>
  );
}

function UnlockForm() {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [wait, setWait] = useState(() => lockoutRemaining());
  const [forgot, setForgot] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait(lockoutRemaining()), 500);
    return () => clearInterval(t);
  }, [wait]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass || busy || wait > 0) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(pass);
    } catch (err) {
      if (err instanceof LockedOutError) setWait(err.waitMs);
      else if (err instanceof WrongPasscodeError) {
        setError("That passcode isn't right.");
        setShake((n) => n + 1);
        setWait(lockoutRemaining());
      } else setError(err instanceof Error ? err.message : "The saved data couldn't be opened.");
      setPass("");
      setBusy(false);
      formRef.current?.querySelector("input")?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">Locked</p>
          <h1 className="display mt-2 text-[2rem]">Welcome back</h1>
          <p className="mt-2 text-[0.95rem] text-muted">Enter your passcode to open the diary.</p>
        </div>
        <div key={shake} className={shake ? "animate-shake" : ""}>
          <PasscodeField id="pass" label="Passcode" value={pass} onChange={setPass} autoFocus autoComplete="current-password" invalid={!!error} />
        </div>
        {(error || wait > 0) && (
          <p role="alert" className="-mt-2 text-sm font-medium text-danger">
            {wait > 0 ? `Too many tries. Wait ${Math.ceil(wait / 1000)}s, then try again.` : error}
          </p>
        )}
        <Button type="submit" disabled={!pass || busy || wait > 0}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
      </form>
      <div className="border-t border-line pt-5">
        {!forgot ? (
          <button type="button" onClick={() => setForgot(true)} className="text-sm font-semibold text-accent hover:underline">
            Forgot passcode?
          </button>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted">The diary is encrypted with your passcode, so it can&apos;t be opened without it. You can erase it from this phone, set a new passcode, then restore a backup file in Settings (you&apos;ll need the passcode you had when you made that backup).</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={confirmErase ? "danger" : "secondary"} onClick={() => (confirmErase ? eraseEverything() : setConfirmErase(true))}>
                {confirmErase ? "Erase everything on this phone" : "Erase and start over…"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setForgot(false);
                  setConfirmErase(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LockScreen({ status }: { status: VaultStatus }) {
  if (status === "loading") return <div className="min-h-dvh bg-background" aria-busy="true" />;
  return (
    <main className="px-gutter pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center gap-5 py-6">
      <div className="flex w-full max-w-[420px] items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Logo size={44} />
          <span className="display text-xl">LittleSteps</span>
        </span>
        <InstallButton />
      </div>
      <div className="animate-rise w-full max-w-[420px] rounded-[28px] border border-line bg-surface p-6 shadow-card sm:p-8">{status === "setup" ? <SetupForm /> : <UnlockForm />}</div>
      <p className="max-w-[420px] text-center text-xs leading-relaxed text-muted">Private to this phone. Nothing you record is sent anywhere.</p>
    </main>
  );
}
