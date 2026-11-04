"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const inputCls =
  "block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-60";

export function AdminPage({ title, intro, children, wide }: { title: string; intro?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={cn("mx-auto space-y-6 px-4 py-8 sm:px-6", wide ? "max-w-7xl" : "max-w-4xl")}>
      <header>
        <h1 className="font-display text-4xl text-primary">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      </header>
      {children}
    </main>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-border bg-card p-5", className)}>
      {title && <h2 className="mb-4 font-display text-2xl text-primary">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({
  label, value, onChange, error, hint, multiline, rows = 3, maxLength, type = "text", placeholder, disabled, id,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; multiline?: boolean; rows?: number;
  maxLength?: number; type?: string; placeholder?: string; disabled?: boolean; id?: string;
}) {
  const fid = id ?? `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const props = {
    id: fid, value, maxLength, placeholder, disabled, className: inputCls, "aria-invalid": !!error,
    "aria-describedby": error ? `${fid}-err` : hint ? `${fid}-hint` : undefined,
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fid} className="text-sm font-medium">{label}</label>
        {maxLength && <span className="text-xs tabular-nums text-muted-foreground" aria-hidden>{value.length}/{maxLength}</span>}
      </div>
      <div className="mt-1.5">
        {multiline ? <textarea rows={rows} {...props} onChange={(e) => onChange(e.target.value)} /> : <input type={type} {...props} onChange={(e) => onChange(e.target.value)} />}
      </div>
      {error ? <p id={`${fid}-err`} className="mt-1 text-sm text-destructive">{error}</p> : hint ? <p id={`${fid}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", disabled && "opacity-60")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "good"; children: React.ReactNode }) {
  const tones = { info: "border-border bg-secondary", warn: "border-gold bg-gold/10", error: "border-destructive/40 bg-destructive/5 text-destructive", good: "border-primary/30 bg-primary/5 text-primary" };
  return <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone])}>{children}</p>;
}

/** Field-level messages from a 400 response: { "seo.title": "Too long" }. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !Array.isArray(e.details)) return {};
  return Object.fromEntries((e.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
}

/** Wraps a save/delete call with busy + success/error state for the UI. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useCallback(async <T,>(fn: () => Promise<T>, successText = "Saved"): Promise<T | undefined> => {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await fn();
      setMessage({ tone: "good", text: successText });
      return result;
    } catch (e) {
      setErrors(fieldErrors(e));
      // Field-level validation errors point at the form; any other server message (e.g. "wrong file type") is shown as is.
      const hasFieldErrors = e instanceof ApiError && e.status === 400 && Array.isArray(e.details) && e.details.length > 0;
      setMessage({ tone: "error", text: e instanceof ApiError ? (hasFieldErrors ? "Please fix the highlighted fields." : e.message) : e instanceof Error ? e.message : "Couldn’t reach the server. Try again." });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  const clear = useCallback(() => {
    setMessage(null);
    setErrors({});
  }, []);
  return { busy, message, errors, run, clear };
}

export function ActionMessage({ message }: { message: { tone: "good" | "error"; text: string } | null }) {
  return message ? <Notice tone={message.tone}>{message.text}</Notice> : null;
}
