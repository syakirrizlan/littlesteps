"use client";

import { useSyncExternalStore } from "react";
import type { CareData } from "../care/types";
import { parseCareData } from "../care/schema";
import { deriveKey, isSealedRecord, open, PBKDF2_ITERATIONS, randomBytes, saltOf, seal, type SealedRecord } from "./crypto";

/**
 * The vault keeps every record encrypted in this phone's storage. It is opened with the
 * passcode; the key only ever lives in memory and is dropped when the app locks.
 * Adapted from the Finance Tracker's vault.
 *
 * Rules that keep the data safe:
 * - Every write goes through one queue, so writes land in order.
 * - Each queued write carries the snapshot AND the key/salt it must be sealed with,
 *   so locking never drops an edit and a record is never sealed with mismatched parts.
 * - Changing the passcode re-encrypts inside the same queue and only switches keys
 *   after the new record is safely written.
 * - Locking in one window locks every window.
 */
export type VaultStatus = "loading" | "setup" | "locked" | "unlocked";

interface Session {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}

const VAULT_KEY = "ls.vault.v1";
const FAILS_KEY = "ls.lock.fails";
const LOCK_SIGNAL_KEY = "ls.lock.signal";
const CHANNEL = "ls-vault";
export const LOCKED_EVENT = "littlesteps-locked";

let status: VaultStatus = "loading";
let session: Session | null = null;
let payload: CareData | null = null;
let saveError: string | null = null;
let saving: Promise<void> = Promise.resolve();
let pendingJob: { snapshot: CareData; sess: Session } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// ---------- storage helpers ----------

function readRecord(): SealedRecord | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VAULT_KEY) ?? "null");
    return isSealedRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasAnyRecord(): boolean {
  try {
    return localStorage.getItem(VAULT_KEY) !== null;
  } catch {
    return false;
  }
}

// ---------- lifecycle ----------

function init() {
  if (status !== "loading" || typeof window === "undefined") return;
  // Any record at all (even one this version can't read) means a vault exists: never offer setup over it.
  status = hasAnyRecord() ? "locked" : "setup";

  window.addEventListener("storage", (e) => {
    if (e.key === LOCK_SIGNAL_KEY) return lockHere();
    if (e.key === VAULT_KEY) onVaultChangedElsewhere();
  });
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (m) => m.data === "lock" && lockHere();
  } catch {
    /* BroadcastChannel unavailable: the storage signal still works */
  }
}

function onVaultChangedElsewhere() {
  if (!hasAnyRecord()) {
    session = null;
    payload = null;
    status = "setup";
    window.dispatchEvent(new Event(LOCKED_EVENT));
    return notify();
  }
  if (status === "setup") {
    status = "locked";
    return notify();
  }
  if (status === "unlocked" && session) {
    const record = readRecord();
    const sess = session;
    if (!record) return lock();
    open<unknown>(record, sess.key).then(
      (p) => {
        const data = parseCareData(p);
        if (status === "unlocked" && session === sess && data) {
          payload = data;
          notify();
        }
      },
      () => lock(), // passcode changed in another window
    );
  }
}

export function subscribeVault(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useVaultStatus(): VaultStatus {
  return useSyncExternalStore(
    subscribeVault,
    () => {
      init();
      return status;
    },
    () => "loading",
  );
}

/** Last save failure (e.g. storage full), or null. */
export function useVaultSaveError(): string | null {
  return useSyncExternalStore(subscribeVault, () => saveError, () => null);
}

// ---------- writes ----------

async function persist(snapshot: CareData, sess: Session) {
  const record = await seal(snapshot, sess.key, sess.salt, sess.iterations);
  localStorage.setItem(VAULT_KEY, JSON.stringify(record));
}

/** Queue a save of the current payload. Only the newest snapshot waiting in the queue is written. */
function schedulePersist() {
  if (!payload || !session) return;
  const alreadyQueued = pendingJob !== null;
  pendingJob = { snapshot: payload, sess: session };
  if (alreadyQueued) return;
  saving = saving.then(async () => {
    const job = pendingJob;
    pendingJob = null;
    if (!job) return;
    const sess = session ?? job.sess;
    try {
      await persist(job.snapshot, sess);
      if (saveError) {
        saveError = null;
        notify();
      }
    } catch {
      saveError = "Your last change couldn't be saved because this phone's storage is full. Download a backup in Settings.";
      notify();
    }
  });
}

/** Resolves when every queued encrypted write has finished. */
export const flushVault = () => saving;

// ---------- setup ----------

export class VaultExistsError extends Error {}

/** First run: create the vault with a new passcode. */
export async function createVault(passcode: string, initialData: CareData) {
  if (hasAnyRecord()) {
    status = "locked";
    notify();
    throw new VaultExistsError("Already set up in another window");
  }
  const salt = randomBytes(16);
  const sess: Session = { key: await deriveKey(passcode, salt, PBKDF2_ITERATIONS), salt, iterations: PBKDF2_ITERATIONS };
  if (hasAnyRecord()) {
    status = "locked";
    notify();
    throw new VaultExistsError("Already set up in another window");
  }
  await persist(initialData, sess);
  session = sess;
  payload = initialData;
  resetFails();
  status = "unlocked";
  notify();
}

// ---------- unlock & throttling ----------

interface Fails {
  count: number;
  until: number;
}
function readFails(): Fails {
  try {
    return { count: 0, until: 0, ...(JSON.parse(localStorage.getItem(FAILS_KEY) ?? "{}") as Partial<Fails>) };
  } catch {
    return { count: 0, until: 0 };
  }
}
function resetFails() {
  try {
    localStorage.removeItem(FAILS_KEY);
  } catch {
    /* ignore */
  }
}
/** Milliseconds until another attempt is allowed (0 = now). */
export function lockoutRemaining(): number {
  return Math.max(0, readFails().until - Date.now());
}

export class WrongPasscodeError extends Error {}
export class LockedOutError extends Error {
  constructor(public waitMs: number) {
    super("Too many attempts");
  }
}

export async function unlock(passcode: string) {
  const wait = lockoutRemaining();
  if (wait > 0) throw new LockedOutError(wait);
  const record = readRecord();
  if (!record) throw new Error("This app's saved data can't be read.");
  const salt = saltOf(record);
  const key = await deriveKey(passcode, salt, record.iterations);
  let opened: unknown;
  try {
    opened = await open<unknown>(record, key);
  } catch {
    // After 5 wrong tries: wait 30s, then 60s, 120s… (max 15 minutes)
    const f = readFails();
    const count = f.count + 1;
    const until = count >= 5 ? Date.now() + Math.min(30_000 * 2 ** (count - 5), 15 * 60_000) : 0;
    try {
      localStorage.setItem(FAILS_KEY, JSON.stringify({ count, until }));
    } catch {
      /* ignore */
    }
    throw new WrongPasscodeError("Wrong passcode");
  }
  const data = parseCareData(opened);
  if (!data) throw new Error("The saved data was made by a newer version of LittleSteps. Reload the app to update it.");
  session = { key, salt, iterations: record.iterations };
  payload = data;
  saveError = null;
  resetFails();
  status = "unlocked";
  notify();
}

// ---------- lock ----------

function lockHere() {
  if (status !== "unlocked") return;
  session = null; // queued writes keep the session they captured, so no edit is lost
  payload = null;
  status = "locked";
  window.dispatchEvent(new Event(LOCKED_EVENT));
  notify();
}

/** Lock every open window of the app. */
export function lock() {
  lockHere();
  try {
    localStorage.setItem(LOCK_SIGNAL_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage("lock");
    bc.close();
  } catch {
    /* ignore */
  }
}

// ---------- passcode rules & change ----------

const COMMON = new Set(["password", "passw0rd", "12345678", "123456789", "1234567890", "qwertyuiop", "qwerty123", "iloveyou", "11111111", "00000000", "abcd1234", "password1", "abc12345", "88888888"]);

/** Returns a problem with the passcode, or null if it's acceptable. */
export function passcodeProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (/^\d+$/.test(p)) return "Don't use only numbers; add a word or letters.";
  if (/^(.)\1+$/.test(p)) return "Don't repeat one character.";
  if (COMMON.has(p.toLowerCase())) return "That passcode is too common.";
  return null;
}

export async function changePasscode(current: string, next: string) {
  const problem = passcodeProblem(next);
  if (problem) throw new Error(problem);
  const record = readRecord();
  if (!record || status !== "unlocked") throw new Error("Unlock the app first.");
  try {
    await open(record, await deriveKey(current, saltOf(record), record.iterations));
  } catch {
    throw new WrongPasscodeError("Current passcode is wrong");
  }
  const newSalt = randomBytes(16);
  const newSess: Session = { key: await deriveKey(next, newSalt, PBKDF2_ITERATIONS), salt: newSalt, iterations: PBKDF2_ITERATIONS };

  let result: Error | null = null;
  saving = saving.then(async () => {
    if (status !== "unlocked" || !payload) {
      result = new Error("The app locked during the change, so the passcode wasn't changed.");
      return;
    }
    try {
      await persist(payload, newSess);
      session = newSess;
      pendingJob = pendingJob ? { ...pendingJob, sess: newSess } : null;
    } catch {
      result = new Error("Couldn't save with the new passcode; the old one still works.");
    }
  });
  await saving;
  if (result) throw result;
}

// ---------- erase ----------

/** Forgot passcode: delete everything on this phone so the app can start over. */
export function eraseEverything() {
  try {
    localStorage.removeItem(VAULT_KEY);
    resetFails();
  } catch {
    /* ignore */
  }
  session = null;
  payload = null;
  pendingJob = null;
  status = "setup";
  window.dispatchEvent(new Event(LOCKED_EVENT));
  notify();
}

// ---------- backup ----------

export const BACKUP_APP = "littlesteps";

export interface BackupFile {
  app: typeof BACKUP_APP;
  kind: "backup";
  createdAt: string;
  record: SealedRecord;
}

/** An encrypted copy of everything, opened later with the passcode in use right now. */
export async function makeBackup(now: Date): Promise<string> {
  if (!payload || !session) throw new Error("Unlock the app first.");
  const record = await seal(payload, session.key, session.salt, session.iterations);
  const file: BackupFile = { app: BACKUP_APP, kind: "backup", createdAt: now.toISOString(), record };
  return JSON.stringify(file);
}

export class NotABackupError extends Error {}

/** Opens a backup file. Throws NotABackupError or WrongPasscodeError. Doesn't change anything. */
export async function readBackup(text: string, passcode: string): Promise<{ data: CareData; createdAt: string }> {
  let file: Partial<BackupFile>;
  try {
    file = JSON.parse(text) as Partial<BackupFile>;
  } catch {
    throw new NotABackupError("That file isn't a LittleSteps backup.");
  }
  if (file.app !== BACKUP_APP || file.kind !== "backup" || !isSealedRecord(file.record) || typeof file.createdAt !== "string") {
    throw new NotABackupError("That file isn't a LittleSteps backup.");
  }
  let opened: unknown;
  try {
    opened = await open<unknown>(file.record, await deriveKey(passcode, saltOf(file.record), file.record.iterations));
  } catch {
    throw new WrongPasscodeError("That passcode doesn't open this backup. Use the passcode you had when you made it.");
  }
  const data = parseCareData(opened);
  if (!data) throw new NotABackupError("This backup was made by a newer version of LittleSteps. Reload the app to update it.");
  return { data, createdAt: file.createdAt };
}

// ---------- access for the data store (only while unlocked) ----------

export const vaultData = (): CareData | null => payload;

export function setVaultData(data: CareData) {
  if (!payload) return;
  payload = data;
  schedulePersist();
  notify();
}
