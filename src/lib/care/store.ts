"use client";

import { useSyncExternalStore } from "react";
import type { CareData, Result } from "./types";
import { emptyCareData } from "./types";
import { setVaultData, subscribeVault, vaultData } from "../security/vault";

/**
 * The app's view of the records while the vault is unlocked. Every change goes through
 * apply(), which runs one of the pure rule functions and saves only if it succeeded.
 */
const EMPTY = emptyCareData();

export function useCareData(): CareData {
  return useSyncExternalStore(subscribeVault, () => vaultData() ?? EMPTY, () => EMPTY);
}

/** Runs a rule against the current records. Saves and returns null on success, or returns the message. */
export function apply(op: (d: CareData) => Result): string | null {
  const current = vaultData();
  if (!current) return "The app is locked.";
  const r = op(current);
  if (!r.ok) return r.error;
  if (r.data !== current) setVaultData(r.data);
  return null;
}

export function replaceAll(next: CareData) {
  setVaultData(next);
}
