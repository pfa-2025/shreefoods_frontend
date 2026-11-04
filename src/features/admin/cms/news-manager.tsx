"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { AdminAnnouncement } from "@/types/admin";
import { useAdminQuery } from "../use-admin-query";
import { MediaPicker, Thumb } from "./media-library";
import { ActionMessage, Card, Field, Notice, useAction } from "./ui";

const STATUS_LABEL = { DRAFT: "Draft (hidden)", PUBLISHED: "Published", ARCHIVED: "Archived (hidden)" } as const;

/** <input type=datetime-local> works in local time; the API stores an exact instant. */
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function NewsManager() {
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { data, error, loading, reload } = useAdminQuery<{ announcements: AdminAnnouncement[] }>("/announcements", { refreshMs: 0, onUnauthorized });
  const [editing, setEditing] = useState<string | "new" | null>(null);

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (loading || !data) return <div className="h-48 skeleton rounded-md" aria-busy aria-label="Loading announcements" />;
  const list = data.announcements;

  const move = async (i: number, d: -1 | 1) => {
    const ids = list.map((a) => a.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await adminApi("/announcements/order", { method: "PUT", json: { ids } });
    reload();
  };

  return (
    <div className="space-y-6">
      <Notice>“What’s New” appears on the home page in this order. Only <strong>Published</strong> items whose start time has passed are shown to visitors.</Notice>
      {editing === "new" ? (
        <Card title="New announcement"><AnnouncementForm onDone={() => { setEditing(null); reload(); }} /></Card>
      ) : (
        <Button onClick={() => setEditing("new")} className="h-10 px-5"><Plus aria-hidden /> New announcement</Button>
      )}
      {list.length === 0 && <Notice>No announcements yet.</Notice>}
      <ul className="space-y-4">
        {list.map((a, i) => (
          <li key={a.id} className={cn("rounded-md border border-border bg-card p-5", a.status !== "PUBLISHED" && "bg-secondary/60")}>
            <div className="flex flex-wrap items-center gap-4">
              {a.imageUrl ? <Thumb asset={{ url: a.imageUrl, altText: a.imageAlt }} className="w-24 shrink-0" /> : <div className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">No image</div>}
              <div className="min-w-48 flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS_LABEL[a.status]}
                  {a.publishAt && ` · starts ${new Date(a.publishAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
                  {a.status === "PUBLISHED" && a.publishAt && new Date(a.publishAt) > new Date() && " (scheduled, not yet visible)"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => void move(i, -1)} className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label={`Move ${a.title} down`} disabled={i === list.length - 1} onClick={() => void move(i, 1)} className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <Button variant="outline" onClick={() => setEditing(editing === a.id ? null : a.id)} className="h-9 px-3">Edit</Button>
              </div>
            </div>
            {editing === a.id && <div className="mt-4 border-t border-border pt-4"><AnnouncementForm item={a} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} /></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnnouncementForm({ item, onDone, onCancel }: { item?: AdminAnnouncement; onDone: () => void; onCancel?: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(item?.linkUrl ?? "");
  const [status, setStatus] = useState<AdminAnnouncement["status"]>(item?.status ?? "DRAFT");
  const [publishAt, setPublishAt] = useState(toLocalInput(item?.publishAt ?? null));
  const [image, setImage] = useState<{ id: string; url: string; altText: string } | null>(item?.imageId && item.imageUrl ? { id: item.imageId, url: item.imageUrl, altText: item.imageAlt } : null);
  const { busy, message, errors, run } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const json = { title, body, linkUrl, status, publishAt: fromLocalInput(publishAt), imageId: image?.id ?? null };
    const ok = await run(() => (item ? adminApi(`/announcements/${item.id}`, { method: "PATCH", json }) : adminApi("/announcements", { method: "POST", json })), "Saved");
    if (ok) onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-label={item ? `Edit ${item.title}` : "New announcement"}>
      <Field id={`t-${item?.id ?? "new"}`} label="Title" value={title} onChange={setTitle} maxLength={80} error={errors.title} />
      <Field id={`b-${item?.id ?? "new"}`} label="Short description" value={body} onChange={setBody} multiline rows={2} maxLength={300} error={errors.body} />
      <MediaPicker label="Image" purpose="announcement" value={image} onChange={setImage} />
      <Field id={`l-${item?.id ?? "new"}`} label="Link (optional)" value={linkUrl} onChange={setLinkUrl} placeholder="/menu or https://…" error={errors.linkUrl} hint="A page on this site like /menu, or a full web address." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`s-${item?.id ?? "new"}`} className="text-sm font-medium">Status</label>
          <select id={`s-${item?.id ?? "new"}`} value={status} onChange={(e) => setStatus(e.target.value as AdminAnnouncement["status"])} className="mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Field id={`a-${item?.id ?? "new"}`} label="Show from (optional)" type="datetime-local" value={publishAt} onChange={setPublishAt} error={errors.publishAt} hint="Leave empty to show immediately once published." />
      </div>
      <ActionMessage message={message} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !title.trim()} className="h-10 px-5">{busy ? "Saving…" : "Save"}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="h-10 px-5">Cancel</Button>}
      </div>
    </form>
  );
}
