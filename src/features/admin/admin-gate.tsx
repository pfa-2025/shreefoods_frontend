"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import type { AdminUser } from "@/types/admin";

const AdminContext = createContext<AdminUser | null>(null);
export const useAdmin = (): AdminUser => {
  const a = useContext(AdminContext);
  if (!a) throw new Error("useAdmin must be used inside <AdminGate>");
  return a;
};

/**
 * UX only: redirects signed-out users to the login page. The real protection is the API,
 * which rejects every admin request without a valid session.
 */
const NAV: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: "/admin/live", label: "Live orders" },
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/reviews", label: "Reviews", ownerOnly: true },
  { href: "/admin/news", label: "What’s New", ownerOnly: true },
  { href: "/admin/pages", label: "Pages", ownerOnly: true },
  { href: "/admin/media", label: "Images", ownerOnly: true },
  { href: "/admin/settings", label: "Settings", ownerOnly: true },
];

/** `ownerOnly` pages show a friendly message to staff; the API enforces the same rule on every request. */
export function AdminGate({ children, ownerOnly }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    adminApi<{ admin: AdminUser }>("/auth/me", { signal: ctl.signal })
      .then((r) => setAdmin(r.admin))
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
        else setFailed(true);
      });
    return () => ctl.abort();
  }, [router]);

  const logout = useCallback(async () => {
    await adminApi("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
  }, [router]);

  if (failed) {
    return (
      <p role="alert" className="p-8 text-destructive">
        Couldn’t reach the server. Check your connection and refresh.
      </p>
    );
  }
  if (!admin) return <div className="p-8 text-sm text-muted-foreground" role="status">Loading…</div>;

  return (
    <AdminContext.Provider value={admin}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-6">
            <p className="font-display text-xl text-primary">Shree Foods <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Admin</span></p>
            <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.filter((n) => !n.ownerOnly || admin.role === "OWNER").map((n) => (
                <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className={pathname === n.href ? "font-medium text-primary underline underline-offset-8" : "text-foreground/70 hover:text-primary"}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{admin.name} · {admin.role === "OWNER" ? "Owner" : "Staff"}</span>
            <Button variant="outline" onClick={() => void logout()} className="h-9 px-4">Sign out</Button>
          </div>
        </div>
      </header>
      {ownerOnly && admin.role !== "OWNER" ? (
        <main className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl text-primary">Owner access only</h1>
          <p className="mt-2 text-muted-foreground">This page changes what customers see and pay. Ask the owner to make this change.</p>
        </main>
      ) : (
        children
      )}
    </AdminContext.Provider>
  );
}
