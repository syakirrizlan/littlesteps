"use client";

import { useEffect, useSyncExternalStore } from "react";
import { lock } from "./vault";

/** Minutes of inactivity before the app locks itself (0 = only when the app is closed). */
const MINUTES_KEY = "ls.lock.minutes";
/** Last activity in any window of the app, so idle time is shared between windows. */
const ACTIVITY_KEY = "ls.lock.activity";
export const AUTO_LOCK_CHOICES = [1, 5, 10, 30, 60, 0] as const;
// Shorter default than the Finance Tracker: a phone is easily picked up by someone else.
const DEFAULT_MINUTES = 5;
const listeners = new Set<() => void>();

function readMinutes(): number {
  try {
    const raw = localStorage.getItem(MINUTES_KEY);
    const v = Number(raw);
    return raw !== null && (AUTO_LOCK_CHOICES as readonly number[]).includes(v) ? v : DEFAULT_MINUTES;
  } catch {
    return DEFAULT_MINUTES;
  }
}

export function setAutoLockMinutes(m: number) {
  try {
    localStorage.setItem(MINUTES_KEY, String(m));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useAutoLockMinutes(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readMinutes,
    () => DEFAULT_MINUTES,
  );
}

function lastActivity(fallback: number): number {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? Math.max(v, fallback) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Locks every window after a period without mouse, keyboard or touch activity in any of them.
 * An overdue lock is checked before activity is recorded, so the first click after a long
 * idle (or after the computer wakes up) can't cancel it.
 */
export function useAutoLock() {
  const minutes = useAutoLockMinutes();
  useEffect(() => {
    if (!minutes) return;
    const limit = minutes * 60_000;
    let local = Date.now();
    let lastShared = 0;
    const overdue = () => Date.now() - lastActivity(local) >= limit;
    const check = () => {
      if (overdue()) lock();
    };
    const touch = () => {
      if (overdue()) return lock();
      local = Date.now();
      if (local - lastShared > 5_000) {
        lastShared = local; // share at most every 5 s
        try {
          localStorage.setItem(ACTIVITY_KEY, String(local));
        } catch {
          /* ignore */
        }
      }
    };
    // Unlocking (which mounts this) counts as activity: start the idle clock fresh in every window.
    try {
      localStorage.setItem(ACTIVITY_KEY, String(local));
    } catch {
      /* ignore */
    }
    lastShared = local;
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    const t = setInterval(check, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      clearInterval(t);
    };
  }, [minutes]);
}
