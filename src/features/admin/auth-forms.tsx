"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorState } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";

const input =
  "mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-text">Shree Foods admin</p>
      <h1 className="mb-8 mt-2 font-display text-4xl text-primary">{title}</h1>
      {children}
    </main>
  );
}

function Field({ id, label, error, ...props }: { id: string; label: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} className={input} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      await adminApi("/auth/login", { method: "POST", json: values });
      router.replace("/admin");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setError("Too many attempts. Please wait a minute and try again.");
      else if (e instanceof ApiError && e.status === 401) setError("Invalid email or password.");
      else setError("Couldn’t sign in. Please check your connection and try again.");
    }
  }

  return (
    <Shell title="Sign in">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field id="email" label="Email" type="email" autoComplete="username" error={errors.email?.message} {...register("email")} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        {error && <ErrorState>{error}</ErrorState>}
        <Button type="submit" disabled={isSubmitting} className="h-11 w-full">{isSubmitting ? "Signing in…" : "Sign in"}</Button>
        <p className="text-sm"><Link href="/admin/forgot-password" className="text-primary underline underline-offset-4">Forgot your password?</Link></p>
      </form>
    </Shell>
  );
}

const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: z.infer<typeof forgotSchema>) {
    setError(null);
    try {
      await adminApi("/auth/forgot-password", { method: "POST", json: values });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? "Too many requests. Please wait a minute." : "Couldn’t send the request. Please try again.");
    }
  }

  return (
    <Shell title="Reset password">
      {sent ? (
        <div role="status" className="space-y-4 text-sm">
          <p>If that email belongs to an admin account, a reset link has been sent. The link works for one hour.</p>
          {process.env.NODE_ENV !== "production" && (
            <p className="rounded-md border border-border bg-secondary p-3 text-muted-foreground">Development: email sending isn’t set up yet, so the link is printed in the API server’s terminal.</p>
          )}
          <Link href="/admin/login" className="text-primary underline underline-offset-4">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field id="email" label="Email" type="email" autoComplete="username" error={errors.email?.message} {...register("email")} />
          {error && <ErrorState>{error}</ErrorState>}
          <Button type="submit" disabled={isSubmitting} className="h-11 w-full">{isSubmitting ? "Sending…" : "Send reset link"}</Button>
          <p className="text-sm"><Link href="/admin/login" className="text-primary underline underline-offset-4">Back to sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

const resetSchema = z
  .object({ password: z.string().min(12, "Use at least 12 characters").max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don’t match", path: ["confirm"] });

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: z.infer<typeof resetSchema>) {
    setError(null);
    try {
      await adminApi("/auth/reset-password", { method: "POST", json: { token, password: values.password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "This reset link is invalid or has expired. Request a new one." : "Couldn’t reset the password. Please try again.");
    }
  }

  if (!token) {
    return (
      <Shell title="Set new password">
        <ErrorState>This reset link is incomplete. Request a new one.</ErrorState>
        <p className="mt-4 text-sm"><Link href="/admin/forgot-password" className="text-primary underline underline-offset-4">Request a reset link</Link></p>
      </Shell>
    );
  }
  return (
    <Shell title="Set new password">
      {done ? (
        <div role="status" className="space-y-4 text-sm">
          <p>Your password has been changed. All other sessions were signed out.</p>
          <Link href="/admin/login" className="text-primary underline underline-offset-4">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field id="password" label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          {error && <ErrorState>{error}</ErrorState>}
          <Button type="submit" disabled={isSubmitting} className="h-11 w-full">{isSubmitting ? "Saving…" : "Change password"}</Button>
        </form>
      )}
    </Shell>
  );
}
