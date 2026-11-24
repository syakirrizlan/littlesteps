"use client";

import { useCallback, useEffect, useState } from "react";
import { useCareData } from "@/lib/care/store";
import { useNow, useRoute, type Route } from "@/lib/hooks";
import { lock, useVaultSaveError } from "@/lib/security/vault";
import { DayScreen, DaysScreen } from "./DaysScreen";
import { InstallButton } from "./Install";
import { Logo } from "./Logo";
import { SettingsScreen } from "./SettingsScreen";
import { TodayScreen } from "./TodayScreen";
import { cx, Icon, type IconName } from "./ui";

const TABS: { tab: "today" | "days" | "settings"; label: string; icon: IconName }[] = [
  { tab: "today", label: "Today", icon: "today" },
  { tab: "days", label: "Days", icon: "days" },
  { tab: "settings", label: "Settings", icon: "settings" },
];

export default function AppShell() {
  const data = useCareData();
  const now = useNow();
  const [route, go] = useRoute();
  const saveError = useVaultSaveError();
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const onToast = useCallback((text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const active = route.tab === "day" ? "days" : route.tab;

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur">
        <div className="px-gutter mx-auto flex h-14 max-w-2xl items-center justify-between">
          <button type="button" onClick={() => go({ tab: "today" })} className="flex min-w-0 items-center gap-2.5" aria-label="LittleSteps, go to Today">
            <Logo size={30} />
            <span className="brand min-w-0 truncate text-base">{data.child?.name ? `${data.child.name}'s days` : "LittleSteps"}</span>
          </button>
          <span className="flex shrink-0 items-center gap-1">
            <InstallButton />
            <button type="button" onClick={lock} aria-label="Lock" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-foreground">
              <Icon name="lock" size={16} />
              <span className="max-[399px]:hidden">Lock</span>
            </button>
          </span>
        </div>
      </header>

      {saveError && (
        <p role="alert" className="px-gutter mx-auto mt-3 max-w-2xl">
          <span className="block rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{saveError}</span>
        </p>
      )}

      <main className="px-gutter mx-auto max-w-2xl pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] pt-5">
        <Screen route={route} now={now} go={go} onToast={onToast} />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" aria-label="Main">
        <ul className="px-gutter mx-auto grid max-w-2xl grid-cols-3">
          {TABS.map((t) => {
            const on = active === t.tab;
            return (
              <li key={t.tab}>
                <button
                  type="button"
                  onClick={() => go({ tab: t.tab })}
                  aria-current={on ? "page" : undefined}
                  className={cx("flex w-full flex-col items-center gap-0.5 pb-2 pt-2.5 text-xs font-semibold transition", on ? "text-accent" : "text-muted hover:text-foreground")}
                >
                  <span className={cx("grid h-8 w-14 place-items-center rounded-full transition", on && "bg-accent-soft")}>
                    <Icon name={t.icon} size={22} />
                  </span>
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {toast && (
        <div key={toast.n} role="status" className="animate-rise pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4">
          <span className="rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-card">{toast.text}</span>
        </div>
      )}
    </div>
  );
}

function Screen({ route, now, go, onToast }: { route: Route; now: Date; go: (r: Route, replace?: boolean) => void; onToast: (m: string) => void }) {
  switch (route.tab) {
    case "today":
      return <TodayScreen now={now} onToast={onToast} onGoSettings={() => go({ tab: "settings" })} />;
    case "days":
      return <DaysScreen month={route.month} now={now} go={go} />;
    case "day":
      return <DayScreen date={route.date} now={now} go={go} onToast={onToast} />;
    case "settings":
      return <SettingsScreen onToast={onToast} />;
  }
}
