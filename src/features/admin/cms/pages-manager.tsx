"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { defaultContent, type PageKey } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useAdminQuery } from "../use-admin-query";
import { MediaPicker } from "./media-library";
import { ActionMessage, Card, Field, Notice, Toggle, useAction } from "./ui";

interface Seo { title: string | null; description: string | null; imageUrl: string | null; canonicalUrl: string | null; noIndex: boolean }
interface ApiPage { key: PageKey; content: Record<string, unknown>; seo: Seo }

const PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "menu", label: "Menu", path: "/menu" },
  { key: "story", label: "Our Story", path: "/our-story" },
  { key: "reviews", label: "Reviews", path: "/reviews" },
  { key: "affiliations", label: "Affiliations", path: "/affiliations" },
  { key: "contact", label: "Contact", path: "/contact" },
];

export function PagesManager() {
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { data, error, loading, reload } = useAdminQuery<{ pages: ApiPage[] }>("/pages", { refreshMs: 0, onUnauthorized });
  const [active, setActive] = useState<PageKey>("home");

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (loading || !data) return <div className="h-48 skeleton rounded-md" aria-busy aria-label="Loading pages" />;
  const page = data.pages.find((p) => p.key === active)!;
  const meta = PAGES.find((p) => p.key === active)!;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Pages" className="flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <button key={p.key} role="tab" aria-selected={active === p.key} onClick={() => setActive(p.key)} className={cn("h-9 rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-ring", active === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {p.label}
          </button>
        ))}
      </div>
      {/* key: switching pages remounts the form with that page's saved values */}
      <PageEditor key={active} page={page} label={meta.label} path={meta.path} onSaved={reload} />
    </div>
  );
}

function PageEditor({ page, label, path, onSaved }: { page: ApiPage; label: string; path: string; onSaved: () => void }) {
  const key = page.key;
  const [content, setContent] = useState<Record<string, unknown>>({ ...defaultContent[key], ...page.content });
  const [seo, setSeo] = useState<Seo>(page.seo);
  const [seoImage, setSeoImage] = useState<{ id: string; url: string; altText: string } | null>(page.seo.imageUrl ? { id: "", url: page.seo.imageUrl, altText: "" } : null);
  const { busy, message, errors, run } = useAction();

  const set = <K extends string>(k: K, v: unknown) => setContent((c) => ({ ...c, [k]: v }));
  const text = (k: string) => String(content[k] ?? "");
  const err = (k: string) => errors[`content.${k}`];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminApi("/pages/" + key, { method: "PUT", json: { content, seo: { ...seo, imageUrl: seoImage?.url ?? null } } }), "Saved. The website updates within moments.");
    if (ok) onSaved();
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="space-y-6" aria-label={`${label} page`}>
      <Card title={`${label} page text`}>
        <div className="space-y-4">
          {key === "home" && (
            <>
              <Field label="Small heading above the title" value={text("heroEyebrow")} onChange={(v) => set("heroEyebrow", v)} maxLength={60} error={err("heroEyebrow")} />
              <Field label="Main headline" value={text("heroTitle")} onChange={(v) => set("heroTitle", v)} maxLength={120} error={err("heroTitle")} />
              <Field label="Supporting text" value={text("heroText")} onChange={(v) => set("heroText", v)} multiline maxLength={300} error={err("heroText")} />
            </>
          )}
          {(key === "menu" || key === "contact" || key === "reviews" || key === "affiliations") && (
            <Field label="Introduction under the page title" value={text("intro")} onChange={(v) => set("intro", v)} multiline rows={2} maxLength={300} error={err("intro")} />
          )}
          {key === "contact" && <Notice>Address, phone, email and opening hours are edited under Settings.</Notice>}
          {key === "story" && (
            <>
              <Field label="Headline" value={text("headline")} onChange={(v) => set("headline", v)} maxLength={120} error={err("headline")} />
              <List
                label="Paragraphs" items={(content.paragraphs as string[]) ?? []} addLabel="Add paragraph" max={6}
                onChange={(v) => set("paragraphs", v)}
                render={(v, i, update) => <Field label={`Paragraph ${i + 1}`} value={v} onChange={update} multiline rows={4} maxLength={1200} error={err(`paragraphs.${i}`)} />}
                blank=""
              />
              {err("paragraphs") && <p className="text-sm text-destructive">{err("paragraphs")}</p>}
            </>
          )}
          {key === "reviews" && (
            <>
              <Notice tone="warn">Only add links to your real review pages (Google, Yelp, …). Never paste in made-up quotes.</Notice>
              <List
                label="Review links" items={(content.links as { platform: string; url: string }[]) ?? []} addLabel="Add review link" max={10}
                onChange={(v) => set("links", v)} blank={{ platform: "", url: "" }}
                render={(v, i, update) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Platform" value={v.platform} onChange={(x) => update({ ...v, platform: x })} placeholder="Google" maxLength={40} error={err(`links.${i}.platform`)} />
                    <Field label="Web address" value={v.url} onChange={(x) => update({ ...v, url: x })} placeholder="https://…" error={err(`links.${i}.url`)} />
                  </div>
                )}
              />
            </>
          )}
          {key === "affiliations" && (
            <List
              label="Partners and affiliations" items={(content.items as { name: string; url: string | null }[]) ?? []} addLabel="Add affiliation" max={30}
              onChange={(v) => set("items", v)} blank={{ name: "", url: null }}
              render={(v, i, update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" value={v.name} onChange={(x) => update({ ...v, name: x })} maxLength={80} error={err(`items.${i}.name`)} />
                  <Field label="Website (optional)" value={v.url ?? ""} onChange={(x) => update({ ...v, url: x || null })} placeholder="https://…" error={err(`items.${i}.url`)} />
                </div>
              )}
            />
          )}
        </div>
      </Card>

      <Card title="Search engines & sharing (SEO)">
        <div className="space-y-4">
          <Notice>Leave a field empty to use the website’s default. Changes apply to <strong>{path}</strong>.</Notice>
          <Field label="Page title" value={seo.title ?? ""} onChange={(v) => setSeo({ ...seo, title: v || null })} maxLength={70} error={errors["seo.title"]} hint="Shown in the browser tab and Google results." />
          <Field label="Description" value={seo.description ?? ""} onChange={(v) => setSeo({ ...seo, description: v || null })} multiline rows={2} maxLength={200} error={errors["seo.description"]} hint="One or two sentences shown under the title in Google results." />
          <MediaPicker label="Sharing image" purpose="share" value={seoImage} onChange={setSeoImage} />
          {errors["seo.imageUrl"] && <p className="text-sm text-destructive">{errors["seo.imageUrl"]}</p>}
          <Field label="Canonical address (advanced)" value={seo.canonicalUrl ?? ""} onChange={(v) => setSeo({ ...seo, canonicalUrl: v || null })} placeholder="https://www.yourrestaurant.com/menu" error={errors["seo.canonicalUrl"]} hint="Only set this if the same page is reachable at several addresses." />
          <Toggle label="Hide this page from search engines" checked={seo.noIndex} onChange={(v) => setSeo({ ...seo, noIndex: v })} hint="It stays on the website but won’t appear in Google, and is left out of the sitemap." />
        </div>
      </Card>

      <ActionMessage message={message} />
      <Button type="submit" disabled={busy} className="h-11 px-6">{busy ? "Saving…" : `Save ${label} page`}</Button>
    </form>
  );
}

function List<T>({ label, items, onChange, render, blank, addLabel, max }: { label: string; items: T[]; onChange: (v: T[]) => void; render: (item: T, i: number, update: (v: T) => void) => React.ReactNode; blank: T; addLabel: string; max: number }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
      <ul className="space-y-4">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <div className="min-w-0 flex-1">{render(it, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
            <button type="button" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-6 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      {items.length < max && <Button type="button" variant="outline" onClick={() => onChange([...items, blank])} className="h-9 px-3"><Plus aria-hidden /> {addLabel}</Button>}
    </div>
  );
}
