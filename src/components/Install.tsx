"use client";

import { useState, useSyncExternalStore } from "react";
import { detectPlatform, installSteps } from "@/lib/install-help";
import { isStandalone, promptInstall, useCanInstall } from "@/lib/pwa";
import { Button, cx, Icon, Sheet } from "./ui";

function subscribeDisplay(l: () => void) {
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", l);
  window.addEventListener("appinstalled", l);
  return () => {
    mq?.removeEventListener?.("change", l);
    window.removeEventListener("appinstalled", l);
  };
}

/** True once running as the installed app (Android, desktop, or iPhone Home Screen). */
export function useInstalled(): boolean {
  return useSyncExternalStore(
    subscribeDisplay,
    () => isStandalone() || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => true, // server render: assume installed so nothing flashes
  );
}

/** Opens the browser's own install prompt when it offers one, otherwise step-by-step help. Hidden once installed. */
export function InstallButton({ variant = "pill", className }: { variant?: "pill" | "block"; className?: string }) {
  const installed = useInstalled();
  const canPrompt = useCanInstall();
  const [help, setHelp] = useState(false);
  if (installed) return null;

  async function onClick() {
    if (canPrompt) {
      try {
        await promptInstall();
        return;
      } catch {
        /* the offer expired: fall through to instructions */
      }
    }
    setHelp(true);
  }

  return (
    <>
      {variant === "pill" ? (
        <button
          type="button"
          onClick={onClick}
          aria-label="Install app"
          className={cx("inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent hover:bg-accent hover:text-on-accent", className)}
        >
          <Icon name="install" size={16} /> Install<span className="-ml-1.5 max-[359px]:hidden">&nbsp;app</span>
        </button>
      ) : (
        <Button onClick={onClick} className={className}>
          <Icon name="install" size={18} /> Install LittleSteps
        </Button>
      )}
      {help && <InstallHelp onClose={() => setHelp(false)} />}
    </>
  );
}

export function InstallHelp({ onClose }: { onClose: () => void }) {
  const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const s = installSteps(p);
  return (
    <Sheet title={s.title} onClose={onClose} footer={<Button className="w-full" data-autofocus onClick={onClose}>Got it</Button>}>
      <ol className="flex flex-col gap-3">
        {s.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      {s.note && <p className="rounded-2xl bg-peach-soft px-4 py-3 text-sm">{s.note}</p>}
    </Sheet>
  );
}
