"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Stars } from "@/components/reviews/stars";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { formatOrderNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminReview, AdminReviewsPage } from "@/types/admin";
import { useAdminQuery } from "../use-admin-query";
import { ActionMessage, Field, Notice, useAction } from "./ui";

type Filter = "PENDING" | "PUBLISHED" | "HIDDEN" | "ALL";
const STATUS_LABEL = { PENDING: "Waiting for approval", PUBLISHED: "Published", HIDDEN: "Hidden" } as const;

export function ReviewsManager() {
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [page, setPage] = useState(1);
  const qs = `?${filter === "ALL" ? "" : `status=${filter}&`}page=${page}`;
  const { data, error, loading, reload } = useAdminQuery<AdminReviewsPage>(`/reviews${qs}`, { refreshMs: 30_000, onUnauthorized });
  // A review often leaves the current tab after an action (Waiting -> Published), so confirm at page level where it stays visible.
  const [flash, setFlash] = useState<string | null>(null);
  const changed = (message?: string) => {
    if (message) {
      setFlash(message);
      setTimeout(() => setFlash(null), 6000);
    }
    reload();
  };

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "PENDING", label: "Waiting", count: data?.counts.pending },
    { key: "PUBLISHED", label: "Published", count: data?.counts.published },
    { key: "HIDDEN", label: "Hidden", count: data?.counts.hidden },
    { key: "ALL", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <Notice>New reviews stay private until you publish them. Only the customer’s first name and last initial is ever shown publicly, never their email or phone.</Notice>
      {flash && <Notice tone="good">{flash}</Notice>}
      <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={filter === t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={cn("h-9 rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-ring", filter === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {t.label}{t.count !== undefined && <span className={cn("ml-2 rounded-md px-1.5 py-0.5 text-xs tabular-nums", filter === t.key ? "bg-primary-foreground/20" : t.key === "PENDING" && t.count > 0 ? "bg-gold" : "bg-muted")}>{t.count}</span>}
          </button>
        ))}
      </div>

      {error && !data ? <Notice tone="error">{error}</Notice>
        : loading ? <div className="h-40 skeleton rounded-md" aria-busy aria-label="Loading reviews" />
        : data && data.reviews.length === 0 ? <Notice>{filter === "PENDING" ? "Nothing is waiting for approval." : "No reviews here yet."}</Notice>
        : (
          <>
            <ul className="space-y-4">{data?.reviews.map((r) => <ReviewRow key={r.id} review={r} onChanged={changed} />)}</ul>
            {data && data.total > data.pageSize && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{data.total} reviews</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span>Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
                  <Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}

function ReviewRow({ review: r, onChanged }: { review: AdminReview; onChanged: (message?: string) => void }) {
  const [reply, setReply] = useState(r.reply ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, message, errors, run } = useAction();
  const patch = (json: object, ok: string) => void run(() => adminApi(`/reviews/${r.id}`, { method: "PATCH", json }), ok).then((x) => x && onChanged(ok));

  return (
    <li className={cn("rounded-md border bg-card p-5", r.status === "PENDING" ? "border-2 border-gold" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><Stars value={r.rating} size="size-5" /><span className="text-sm text-muted-foreground">shown as <strong className="text-foreground">{r.displayName}</strong></span></div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatOrderNumber(r.orderNumber)} · {r.customerName} · {r.customerEmail} · {new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <span className={cn("rounded-md px-2 py-0.5 text-xs", r.status === "PUBLISHED" ? "bg-primary/10 text-primary" : r.status === "PENDING" ? "bg-gold/25" : "bg-muted text-muted-foreground")}>{STATUS_LABEL[r.status]}</span>
      </div>
      {r.comment ? <p className="mt-3 whitespace-pre-wrap text-sm">{r.comment}</p> : <p className="mt-3 text-sm italic text-muted-foreground">Rating only, no comment.</p>}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <Field id={`reply-${r.id}`} label="Public reply (optional)" value={reply} onChange={setReply} multiline rows={2} maxLength={500} error={errors.reply} hint="Shown under the review once it is published." />
        <ActionMessage message={message} />
        <div className="flex flex-wrap gap-2">
          {r.status !== "PUBLISHED" && <Button disabled={busy} onClick={() => patch({ status: "PUBLISHED", ...(reply !== (r.reply ?? "") && { reply }) }, "Published. It is now on the website.")} className="h-9 px-4">Publish</Button>}
          {r.status !== "HIDDEN" && <Button variant="outline" disabled={busy} onClick={() => patch({ status: "HIDDEN" }, r.status === "PUBLISHED" ? "Hidden from the website." : "Hidden.")} className="h-9 px-4">{r.status === "PUBLISHED" ? "Hide from website" : "Reject"}</Button>}
          <Button variant="outline" disabled={busy || reply === (r.reply ?? "")} onClick={() => patch({ reply }, reply ? "Reply saved." : "Reply removed.")} className="h-9 px-4">Save reply</Button>
          {confirmDelete
            ? <Button disabled={busy} onClick={() => void run(async () => { await adminApi(`/reviews/${r.id}`, { method: "DELETE" }); return true; }, "Deleted").then((ok) => ok && onChanged("Review deleted."))} className="h-9 bg-destructive px-4 text-white hover:bg-destructive/90">Confirm delete</Button>
            : <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)} className="h-9 px-3 text-destructive hover:text-destructive">Delete</Button>}
        </div>
      </div>
    </li>
  );
}
