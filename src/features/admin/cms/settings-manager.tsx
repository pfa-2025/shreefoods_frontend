"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { useAdminQuery } from "../use-admin-query";
import { MediaPicker } from "./media-library";
import { formatBps, parsePercentToBps } from "./money";
import { ActionMessage, Card, Field, Notice, Toggle, useAction } from "./ui";

interface Settings {
  restaurantName: string; phone: string | null; email: string | null; address: string | null;
  openingHours: { day: string; hours: string }[]; socialLinks: { label: string; url: string }[];
  taxRateBps: number; pickupEnabled: boolean; dineInEnabled: boolean; deliveryEnabled: boolean; ordersOpen: boolean; cartEnabled: boolean;
  paymentQrId: string | null; paymentQrUrl: string | null; paymentQrAlt: string; paymentHandle: string | null; paymentInstructions: string;
}

export function SettingsManager() {
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { data, error, loading, reload } = useAdminQuery<Settings>("/settings", { refreshMs: 0, onUnauthorized });
  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (loading || !data) return <div className="h-48 skeleton rounded-md" aria-busy aria-label="Loading settings" />;
  return <SettingsForm initial={data} onSaved={reload} />;
}

function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const [s, setS] = useState({
    restaurantName: initial.restaurantName, phone: initial.phone ?? "", email: initial.email ?? "", address: initial.address ?? "",
    openingHours: initial.openingHours, socialLinks: initial.socialLinks, tax: formatBps(initial.taxRateBps),
    pickupEnabled: initial.pickupEnabled, dineInEnabled: initial.dineInEnabled, ordersOpen: initial.ordersOpen, cartEnabled: initial.cartEnabled,
    paymentHandle: initial.paymentHandle ?? "", paymentInstructions: initial.paymentInstructions,
  });
  const [qr, setQr] = useState<{ id: string; url: string; altText: string } | null>(initial.paymentQrId && initial.paymentQrUrl ? { id: initial.paymentQrId, url: initial.paymentQrUrl, altText: initial.paymentQrAlt } : null);
  const { busy, message, errors, run } = useAction();
  const patch = (p: Partial<typeof s>) => setS((x) => ({ ...x, ...p }));

  const bps = parsePercentToBps(s.tax);
  const taxError = bps === null ? "Enter a percentage like 8.25" : bps > 2500 ? "Tax can’t exceed 25%" : errors.taxRateBps;
  const qrChanged = (qr?.id ?? null) !== initial.paymentQrId;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (bps === null) return;
    const ok = await run(() => adminApi("/settings", {
      method: "PUT",
      json: {
        restaurantName: s.restaurantName, phone: s.phone, email: s.email, address: s.address,
        openingHours: s.openingHours, socialLinks: s.socialLinks, taxRateBps: bps,
        pickupEnabled: s.pickupEnabled, dineInEnabled: s.dineInEnabled, ordersOpen: s.ordersOpen, cartEnabled: s.cartEnabled,
        paymentQrId: qr?.id ?? null, paymentHandle: s.paymentHandle, paymentInstructions: s.paymentInstructions,
      },
    }), "Settings saved");
    if (ok) onSaved();
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="space-y-6" aria-label="Restaurant settings">
      <Card title="Restaurant">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name" value={s.restaurantName} onChange={(v) => patch({ restaurantName: v })} maxLength={80} error={errors.restaurantName} />
          <Field label="Phone" value={s.phone} onChange={(v) => patch({ phone: v })} maxLength={30} error={errors.phone} />
          <Field label="Email" type="email" value={s.email} onChange={(v) => patch({ email: v })} error={errors.email} />
          <Field label="Address" value={s.address} onChange={(v) => patch({ address: v })} maxLength={200} error={errors.address} />
        </div>
      </Card>

      <Card title="Opening hours">
        <Rows
          items={s.openingHours} max={14} addLabel="Add hours" blank={{ day: "", hours: "" }} label="hours row"
          onChange={(v) => patch({ openingHours: v })}
          render={(r, i, up) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Days" value={r.day} onChange={(x) => up({ ...r, day: x })} placeholder="Tuesday – Friday" maxLength={40} error={errors[`openingHours.${i}.day`]} />
              <Field label="Hours" value={r.hours} onChange={(x) => up({ ...r, hours: x })} placeholder="11:30 AM – 9:00 PM, or Closed" maxLength={60} error={errors[`openingHours.${i}.hours`]} />
            </div>
          )}
        />
      </Card>

      <Card title="Social links">
        <Rows
          items={s.socialLinks} max={8} addLabel="Add link" blank={{ label: "", url: "" }} label="social link"
          onChange={(v) => patch({ socialLinks: v })}
          render={(r, i, up) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={r.label} onChange={(x) => up({ ...r, label: x })} placeholder="Instagram" maxLength={30} error={errors[`socialLinks.${i}.label`]} />
              <Field label="Web address" value={r.url} onChange={(x) => up({ ...r, url: x })} placeholder="https://instagram.com/…" error={errors[`socialLinks.${i}.url`]} />
            </div>
          )}
        />
      </Card>

      <Card title="Ordering">
        <div className="space-y-4">
          <Toggle label="Show Add to cart and cart" checked={s.cartEnabled} onChange={(v) => patch({ cartEnabled: v })} hint="Turn off for a menu-only website: the Add buttons, cart icon and Order Now button are hidden and the server refuses orders. Turn it back on to take orders again." />
          <Toggle label="Accepting online orders" checked={s.ordersOpen} onChange={(v) => patch({ ordersOpen: v })} hint="Turn off to stop new orders (for example when the kitchen is closed). Customers can still browse the menu." />
          <Toggle label="Pickup" checked={s.pickupEnabled} onChange={(v) => patch({ pickupEnabled: v })} />
          <Toggle label="Dine-in" checked={s.dineInEnabled} onChange={(v) => patch({ dineInEnabled: v })} />
          <Toggle label="Delivery" checked={false} disabled onChange={() => undefined} hint="Not available yet. It needs delivery addresses and fees to be set up first." />
          {errors.pickupEnabled && <p className="text-sm text-destructive">{errors.pickupEnabled}</p>}
          <div className="max-w-xs">
            <Field label="Sales tax rate (%)" value={s.tax} onChange={(v) => patch({ tax: v })} error={taxError} hint="Applied to the subtotal at checkout, e.g. 8.25" />
          </div>
        </div>
      </Card>

      <Card title="Payment">
        <div className="space-y-4">
          <Notice tone="warn">Customers scan this QR code and send their money to this account. Check it carefully, and test it with a small payment after changing it.</Notice>
          <MediaPicker label="Payment QR code" purpose="qr" value={qr} onChange={setQr} />
          {errors.paymentQrId && <p className="text-sm text-destructive">{errors.paymentQrId}</p>}
          {qrChanged && <Notice tone="warn">You’re changing the payment QR. Orders placed after you save will show the new one.</Notice>}
          <Field label="Account handle shown next to the QR (optional)" value={s.paymentHandle} onChange={(v) => patch({ paymentHandle: v })} maxLength={100} placeholder="paypal.me/yourrestaurant" error={errors.paymentHandle} />
          <Field label="Instructions for customers" value={s.paymentInstructions} onChange={(v) => patch({ paymentInstructions: v })} multiline rows={3} maxLength={500} error={errors.paymentInstructions} />
        </div>
      </Card>

      <ActionMessage message={message} />
      <Button type="submit" disabled={busy || bps === null} className="h-11 px-6">{busy ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}

function Rows<T>({ items, onChange, render, blank, addLabel, max, label }: { items: T[]; onChange: (v: T[]) => void; render: (item: T, i: number, update: (v: T) => void) => React.ReactNode; blank: T; addLabel: string; max: number; label: string }) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">{render(it, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
            <button type="button" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-6 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      {items.length < max && <Button type="button" variant="outline" onClick={() => onChange([...items, blank])} className="h-9 px-3"><Plus aria-hidden /> {addLabel}</Button>}
    </div>
  );
}
