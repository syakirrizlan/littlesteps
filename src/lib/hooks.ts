"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** The current time, refreshed every 30 seconds and when the app comes back into view. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

export type Route = { tab: "today" } | { tab: "days"; month?: string } | { tab: "day"; date: string } | { tab: "settings" };

/** Screens are kept in the address hash (#today, #days, #day-2026-11-24, #settings) so the phone's back gesture works. */
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const day = /^day-(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (day) return { tab: "day", date: day[1] };
  const month = /^days-(\d{4}-\d{2})$/.exec(h);
  if (month) return { tab: "days", month: month[1] };
  if (h === "days") return { tab: "days" };
  if (h === "settings") return { tab: "settings" };
  return { tab: "today" };
}

export function routeHash(r: Route): string {
  if (r.tab === "day") return `#day-${r.date}`;
  if (r.tab === "days") return r.month ? `#days-${r.month}` : "#days";
  return `#${r.tab}`;
}

function subscribeHash(l: () => void) {
  window.addEventListener("hashchange", l);
  return () => window.removeEventListener("hashchange", l);
}

export function useRoute(): [Route, (r: Route, replace?: boolean) => void] {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const go = (r: Route, replace = false) => {
    const next = routeHash(r);
    if (next === window.location.hash) return;
    if (replace) {
      history.replaceState(null, "", next);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else window.location.hash = next;
    window.scrollTo({ top: 0 });
  };
  return [parseRoute(hash), go];
}
