"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-foreground hover:border-accent hover:text-accent",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-danger text-on-status hover:brightness-110",
};

export function Button({ variant = "primary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[0.95rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export const inputClass =
  "w-full min-h-12 rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-[3px] focus:ring-accent/20";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** A row of big tappable options (radio group). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  columns?: number;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-2 py-2 text-center text-sm font-semibold transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-accent/30",
                on ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-foreground hover:border-accent",
              )}
            >
              <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {children}
    </p>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    (first ?? ref.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="animate-fade absolute inset-0 cursor-default bg-[#1c1830]/45" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-surface shadow-card outline-none sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 id={titleId} className="display text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 pt-3 [&>*]:mb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-[24px] border border-line bg-surface p-5 shadow-card", className)}>{children}</section>;
}

/** Small inline icons for entry types and navigation. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "meal":
      return <svg {...p}><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></svg>;
    case "nap":
      return <svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>;
    case "activity":
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3.5 9.5c5 1 12 1 17 0M3.5 14.5c5-1 12-1 17 0" /></svg>;
    case "health":
      return <svg {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z" /></svg>;
    case "medication":
      return <svg {...p}><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="m9.5 8.5 5 7" /></svg>;
    case "incident":
      return <svg {...p}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>;
    case "note":
      return <svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
    case "today":
      return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
    case "days":
      return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
    case "settings":
      return <svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
    case "lock":
      return <svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>;
    case "plus":
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "chevron-left":
      return <svg {...p}><path d="m15 5-7 7 7 7" /></svg>;
    case "chevron-right":
      return <svg {...p}><path d="m9 5 7 7-7 7" /></svg>;
    case "edit":
      return <svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></svg>;
  }
}
export type IconName = "meal" | "nap" | "activity" | "health" | "medication" | "incident" | "note" | "today" | "days" | "settings" | "lock" | "plus" | "chevron-left" | "chevron-right" | "edit";
