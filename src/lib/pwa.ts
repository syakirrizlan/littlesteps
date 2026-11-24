"use client";

import { useSyncExternalStore } from "react";

/** Chromium's install prompt event (not in TypeScript's DOM types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const isWebOrigin = () => typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);

/** Registers the offline cache and listens for the browser's install prompt. Call once. */
export function startPwa() {
  if (started || !isWebOrigin()) return;
  started = true;

  // public/install-capture.js catches the browser's install offer as early as possible
  // (it can fire before React starts) and keeps it on window.
  const pickUp = () => {
    const early = (window as { __littlestepsInstallPrompt?: BeforeInstallPromptEvent }).__littlestepsInstallPrompt;
    if (early && early !== deferred) {
      deferred = early;
      notify();
    }
  };
  pickUp();
  window.addEventListener("littlesteps-installable", pickUp);
  window.addEventListener("appinstalled", () => {
    deferred = null;
    (window as { __littlestepsInstallPrompt?: unknown }).__littlestepsInstallPrompt = undefined;
    notify();
  });

  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is optional; the app works without it.
    });
  }

  // Ask the browser not to clear this site's data when disk space is low.
  navigator.storage?.persist?.().catch(() => {});
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred !== null,
    () => false,
  );
}

export async function promptInstall() {
  if (!deferred) return;
  const event = deferred;
  deferred = null; // the browser allows each install offer to be used once
  (window as { __littlestepsInstallPrompt?: unknown }).__littlestepsInstallPrompt = undefined;
  notify();
  await event.prompt();
  await event.userChoice;
}

/** True when running as an installed app window (not a browser tab). */
export function isStandalone(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
}
