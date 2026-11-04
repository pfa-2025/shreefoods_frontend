"use client";

import { ArrowDown, ArrowUp, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminMenuCategory, AdminMenuItem } from "@/types/admin";
import { useAdmin } from "../admin-gate";
import { useAdminQuery } from "../use-admin-query";
import { MediaPicker, Thumb } from "./media-library";
import { formatDollars, parseDollars } from "./money";
import { ActionMessage, Card, Field, Notice, Toggle, useAction } from "./ui";

type Menu = { categories: AdminMenuCategory[] };

export function MenuManager() {
  const admin = useAdmin();
  const owner = admin.role === "OWNER";
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { data, error, loading, reload } = useAdminQuery<Menu>("/menu", { refreshMs: 0, onUnauthorized });
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState<string | null>(null); // category id
  const [editing, setEditing] = useState<string | null>(null); // item id
  const [flash, setFlash] = useState<string | null>(null);
  const done = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 5000);
    reload();
  };
  const catAction = useAction();
  const [newCat, setNewCat] = useState("");

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (loading || !data) return <div className="h-64 skeleton rounded-md" aria-busy aria-label="Loading menu" />;

  const cats = data.categories.filter((c) => showArchived || !c.isArchived);
  const move = async (ids: string[], from: number, to: number, path: string, extra: object = {}) => {
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    await adminApi(path, { method: "PUT", json: { ...extra, ids: next } });
    reload();
  };

  return (
    <div className="space-y-6">
      {flash && <Notice tone="good">{flash}</Notice>}
      {!owner && <Notice>You can mark dishes available or unavailable. Ask the owner to change anything else.</Notice>}
      {owner && (
        <Card title="Add a section">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void catAction.run(() => adminApi("/menu/categories", { method: "POST", json: { name: newCat } }), "Section added").then((r) => {
                if (r) {
                  setNewCat("");
                  reload();
                }
              });
            }}
          >
            <div className="min-w-56 flex-1"><Field id="new-cat" label="Section name" value={newCat} onChange={setNewCat} maxLength={60} placeholder="e.g. Catering" error={catAction.errors.name} /></div>
            <Button type="submit" disabled={catAction.busy || !newCat.trim()} className="h-10 px-5"><Plus aria-hidden /> Add section</Button>
          </form>
          <div className="mt-3"><ActionMessage message={catAction.message} /></div>
        </Card>
      )}

      {owner && <Toggle label="Show archived sections and items" checked={showArchived} onChange={setShowArchived} />}

      {cats.map((cat, ci) => {
        const activeIds = data.categories.map((c) => c.id);
        const items = cat.items.filter((i) => showArchived || !i.isArchived);
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className={cn("rounded-md border border-border bg-card", cat.isArchived && "bg-secondary/60")}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <CategoryTitle cat={cat} owner={owner} onSaved={reload} />
              {owner && (
                <div className="flex flex-wrap gap-2">
                  <IconBtn label={`Move ${cat.name} up`} disabled={ci === 0} onClick={() => void move(activeIds, activeIds.indexOf(cat.id), activeIds.indexOf(cat.id) - 1, "/menu/categories/order")}><ArrowUp className="size-4" /></IconBtn>
                  <IconBtn label={`Move ${cat.name} down`} disabled={ci === cats.length - 1} onClick={() => void move(activeIds, activeIds.indexOf(cat.id), activeIds.indexOf(cat.id) + 1, "/menu/categories/order")}><ArrowDown className="size-4" /></IconBtn>
                  <Button variant="outline" onClick={() => void adminApi(`/menu/categories/${cat.id}`, { method: "PATCH", json: { isArchived: !cat.isArchived } }).then(reload)} className="h-9 px-3">
                    {cat.isArchived ? "Restore section" : "Archive section"}
                  </Button>
                </div>
              )}
            </header>
            <ul className="divide-y divide-border">
              {items.map((item, ii) => (
                <li key={item.id} className={cn("px-5 py-4", item.isArchived && "bg-secondary/60")}>
                  <ItemRow item={item} owner={owner} first={ii === 0} last={ii === items.length - 1} onChanged={reload} onEdit={() => setEditing(editing === item.id ? null : item.id)}
                    onMove={(d) => { const ids = cat.items.map((i) => i.id); const at = ids.indexOf(item.id); const to = ids.indexOf(items[ii + d].id); void move(ids, at, to, "/menu/items/order", { categoryId: cat.id }); }} />
                  {editing === item.id && owner && <ItemForm categories={data.categories.filter((c) => !c.isArchived)} item={item} onDone={(m) => { setEditing(null); done(m ?? "Item saved"); }} />}
                </li>
              ))}
              {items.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">No items in this section yet.</li>}
            </ul>
            {owner && !cat.isArchived && (
              <div className="border-t border-border px-5 py-4">
                {adding === cat.id ? (
                  <ItemForm categories={data.categories.filter((c) => !c.isArchived)} defaultCategory={cat.id} onDone={(m) => { setAdding(null); done(m ?? "Item added"); }} onCancel={() => setAdding(null)} />
                ) : (
                  <Button variant="outline" onClick={() => setAdding(cat.id)} className="h-9 px-3"><Plus aria-hidden /> Add item to {cat.name}</Button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function IconBtn({ label, children, ...props }: { label: string } & React.ComponentProps<"button">) {
  return <button type="button" aria-label={label} title={label} {...props} className="flex size-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30">{children}</button>;
}

function CategoryTitle({ cat, owner, onSaved }: { cat: AdminMenuCategory; owner: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const { busy, errors, run } = useAction();
  if (!editing || !owner) {
    return (
      <h2 id={`cat-${cat.id}`} className="font-display text-2xl text-primary">
        {cat.name} {cat.isArchived && <span className="font-sans text-xs uppercase tracking-wider text-muted-foreground">archived</span>}
        {owner && <button type="button" onClick={() => setEditing(true)} className="ml-3 font-sans text-xs text-primary underline underline-offset-4">Rename</button>}
      </h2>
    );
  }
  return (
    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => adminApi(`/menu/categories/${cat.id}`, { method: "PATCH", json: { name } })).then((r) => { if (r) { setEditing(false); onSaved(); } }); }}>
      <Field id={`rename-${cat.id}`} label="Section name" value={name} onChange={setName} maxLength={60} error={errors.name} />
      <Button type="submit" disabled={busy || !name.trim()} className="h-10 px-4">Save</Button>
      <Button type="button" variant="outline" onClick={() => { setName(cat.name); setEditing(false); }} className="h-10 px-4">Cancel</Button>
    </form>
  );
}

function ItemRow({ item, owner, first, last, onChanged, onEdit, onMove }: { item: AdminMenuItem; owner: boolean; first: boolean; last: boolean; onChanged: () => void; onEdit: () => void; onMove: (delta: -1 | 1) => void }) {
  const { busy, message, run } = useAction();
  const setAvail = (v: boolean) => void run(() => adminApi(`/menu/items/${item.id}/availability`, { method: "PATCH", json: { isAvailable: v } }), v ? "Marked available" : "Marked unavailable").then(onChanged);
  return (
    <div className="flex flex-wrap items-center gap-4">
      {item.imageUrl ? <Thumb asset={{ url: item.imageUrl, altText: item.imageAlt }} className="w-20 shrink-0" /> : <div className="flex aspect-[4/3] w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">No photo</div>}
      <div className="min-w-48 flex-1">
        <p className="font-medium">{item.name} <span className="ml-1 tabular-nums text-muted-foreground">{formatUsd(item.priceCents)}</span></p>
        <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
          {item.isFeatured && <Tag tone="gold">Featured</Tag>}
          {!item.isAvailable && <Tag tone="bad">Unavailable</Tag>}
          {item.isArchived && <Tag>Archived</Tag>}
          {item.dietaryLabels.map((d) => <Tag key={d}>{d}</Tag>)}
        </p>
        <ActionMessage message={message} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!item.isArchived && (
          <Button variant={item.isAvailable ? "outline" : "default"} disabled={busy} aria-pressed={item.isAvailable} onClick={() => setAvail(!item.isAvailable)} className="h-9 px-3">
            {item.isAvailable ? "Mark unavailable" : "Mark available"}
          </Button>
        )}
        {owner && (
          <>
            <Button variant="outline" onClick={onEdit} className="h-9 px-3">Edit</Button>
            <IconBtn label={`Duplicate ${item.name}`} onClick={() => void adminApi(`/menu/items/${item.id}/duplicate`, { method: "POST" }).then(onChanged)}><Copy className="size-4" /></IconBtn>
            <IconBtn label={`Move ${item.name} up`} disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></IconBtn>
            <IconBtn label={`Move ${item.name} down`} disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-4" /></IconBtn>
            <Button variant="ghost" onClick={() => void adminApi(`/menu/items/${item.id}`, { method: "PATCH", json: { isArchived: !item.isArchived } }).then(onChanged)} className="h-9 px-3 text-muted-foreground">
              {item.isArchived ? "Restore" : "Archive"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "gold" | "bad" }) {
  return <span className={cn("rounded-md px-1.5 py-0.5", tone === "gold" ? "bg-gold/25" : tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{children}</span>;
}

function ItemForm({ item, categories, defaultCategory, onDone, onCancel }: { item?: AdminMenuItem; categories: AdminMenuCategory[]; defaultCategory?: string; onDone: (message?: string) => void; onCancel?: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? formatDollars(item.priceCents) : "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategory ?? categories[0]?.id ?? "");
  const [image, setImage] = useState<{ id: string; url: string; altText: string } | null>(item?.imageId && item.imageUrl ? { id: item.imageId, url: item.imageUrl, altText: item.imageAlt } : null);
  const [labels, setLabels] = useState(item?.dietaryLabels.join(", ") ?? "");
  const [featured, setFeatured] = useState(item?.isFeatured ?? false);
  const [available, setAvailable] = useState(item?.isAvailable ?? true);
  const { busy, message, errors, run } = useAction();

  const cents = parseDollars(price);
  const priceError = price && cents === null ? "Enter a price like 12 or 12.50" : cents === 0 ? "Price must be above $0" : errors.priceCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cents) return;
    const next = {
      categoryId, name, description, priceCents: cents, imageId: image?.id ?? null, isFeatured: featured, isAvailable: available,
      dietaryLabels: labels.split(",").map((l) => l.trim()).filter(Boolean),
    };
    // Editing sends ONLY what changed, so saving a price can't undo something a colleague changed meanwhile
    // (e.g. staff marking the dish unavailable while the owner had the form open).
    const before: Record<string, unknown> | null = item
      ? { categoryId: item.categoryId, name: item.name, description: item.description, priceCents: item.priceCents, imageId: item.imageId, isFeatured: item.isFeatured, isAvailable: item.isAvailable, dietaryLabels: item.dietaryLabels }
      : null;
    const body = before ? Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]))) : next;
    if (before && Object.keys(body).length === 0) return onDone("No changes to save");
    const ok = await run(() => (item ? adminApi(`/menu/items/${item.id}`, { method: "PATCH", json: body }) : adminApi("/menu/items", { method: "POST", json: body })), item ? "Item saved" : "Item added");
    if (ok) onDone(item ? "Item saved" : "Item added");
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 space-y-4 rounded-md border border-border bg-background p-4" aria-label={item ? `Edit ${item.name}` : "New item"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`n-${item?.id ?? "new"}`} label="Name" value={name} onChange={setName} maxLength={80} error={errors.name} />
        <Field id={`p-${item?.id ?? "new"}`} label="Price (USD)" value={price} onChange={setPrice} placeholder="12.50" error={priceError} hint="Whole dollars or cents, e.g. 7 or 7.50" />
      </div>
      <Field id={`d-${item?.id ?? "new"}`} label="Description" value={description} onChange={setDescription} multiline rows={3} maxLength={500} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`c-${item?.id ?? "new"}`} className="text-sm font-medium">Section</label>
          <select id={`c-${item?.id ?? "new"}`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Field id={`l-${item?.id ?? "new"}`} label="Dietary labels" value={labels} onChange={setLabels} placeholder="vegetarian, gluten-free" hint="Separate with commas" error={errors.dietaryLabels} />
      </div>
      <MediaPicker label="Photo" purpose="dish" value={image} onChange={setImage} />
      <div className="flex flex-wrap gap-6">
        <Toggle label="Featured on the home page" checked={featured} onChange={setFeatured} />
        <Toggle label="Available to order" checked={available} onChange={setAvailable} />
      </div>
      <ActionMessage message={message} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim() || !cents} className="h-10 px-5">{busy ? "Saving…" : item ? "Save changes" : "Add item"}</Button>
        <Button type="button" variant="outline" onClick={() => (onCancel ? onCancel() : onDone(""))} className="h-10 px-5">Cancel</Button>
      </div>
    </form>
  );
}
