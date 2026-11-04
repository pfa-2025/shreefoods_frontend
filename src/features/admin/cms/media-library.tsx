"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi, adminUpload } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/types/admin";
import { useAdminQuery } from "../use-admin-query";
import { ActionMessage, Card, Field, Notice, useAction } from "./ui";
import { useRouter } from "next/navigation";
import { type CropPurpose, MAX_ORIGINAL_BYTES, formatBytes, loadImage } from "./crop-image";
import { useImageCropper } from "./image-cropper";

const sizeLabel = (b: number | null) => (b === null ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const usageText = (u?: MediaAsset["usage"]) =>
  u ? [u.menuItems && `${u.menuItems} menu item${u.menuItems > 1 ? "s" : ""}`, u.announcements && `${u.announcements} announcement${u.announcements > 1 ? "s" : ""}`, u.paymentQr && "payment QR"].filter(Boolean).join(", ") : "";

/** Client-side pre-check for a friendlier message; the server re-validates by file content. */
export function precheckImage(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size > MAX_ORIGINAL_BYTES) return `That file is over ${formatBytes(MAX_ORIGINAL_BYTES)}. Please choose a smaller one.`;
  return null; // bigger-than-5 MB originals are fine: cropping shrinks them before they are sent
}

export function Thumb({ asset, className }: { asset: Pick<MediaAsset, "url" | "altText">; className?: string }) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-md bg-muted", className)}>
      <Image src={asset.url} alt={asset.altText} fill sizes="240px" unoptimized className="object-cover" />
    </div>
  );
}

export function UploadForm({ onUploaded, purpose = "library" }: { onUploaded: (a: MediaAsset) => void; purpose?: CropPurpose }) {
  const input = useRef<HTMLInputElement>(null);
  const cropper = useImageCropper();
  const [source, setSource] = useState<File | null>(null); // what they picked
  const [ready, setReady] = useState<{ file: File; url: string; width: number; height: number } | null>(null); // after cropping
  const [alt, setAlt] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { busy, message, run } = useAction();

  // release the preview picture when it is replaced or the form goes away
  useEffect(() => () => { if (ready) URL.revokeObjectURL(ready.url); }, [ready]);

  const reset = () => {
    if (input.current) input.current.value = "";
    setSource(null);
    setReady(null);
  };

  async function cropIt(f: File) {
    const out = await cropper.crop(f, purpose);
    if (!out) return ready ? undefined : reset(); // cancelled: keep the earlier result if there was one
    const url = URL.createObjectURL(out);
    try {
      const img = await loadImage(url);
      setReady({ file: out, url, width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      setLocalError("That file couldn’t be opened as a picture.");
      reset();
    }
  }

  async function chosen(f: File | undefined) {
    setLocalError(null);
    setReady(null);
    if (!f) return setSource(null);
    const problem = precheckImage(f);
    if (problem) {
      setLocalError(problem);
      return reset();
    }
    setSource(f);
    await cropIt(f);
  }

  async function submit() {
    if (!ready) return setLocalError("Choose an image first.");
    setLocalError(null);
    const form = new FormData();
    form.set("file", ready.file);
    form.set("altText", alt);
    const asset = await run(() => adminUpload<MediaAsset>("/media", form), "Uploaded");
    if (asset) {
      setAlt("");
      reset();
      onUploaded(asset);
    }
  }

  return (
    // A group, not a <form>: this component is used inside other forms (menu item, announcement),
    // and nested forms are invalid HTML (the inner button would submit the OUTER form).
    <div
      role="group"
      aria-label="Upload an image"
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "file") {
          e.preventDefault(); // Enter here means "upload", never "save the surrounding form"
          if (ready) void submit();
        }
      }}
    >
      <div>
        <label htmlFor="up-file" className="text-sm font-medium">Image file</label>
        <input id="up-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm" onChange={(e) => void chosen(e.target.files?.[0])} />
        <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG or WebP. You’ll crop it in the next step; large photos are shrunk automatically.</p>
      </div>

      {ready && source && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-background p-3" data-testid="crop-preview">
          <Image src={ready.url} alt="Preview of the cropped image" width={96} height={96} unoptimized className="h-24 w-auto max-w-40 rounded-md border border-border object-contain" />
          <div className="text-sm">
            <p className="font-medium">Ready to upload</p>
            <p className="text-muted-foreground">{ready.width}×{ready.height} · {formatBytes(ready.file.size)}</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" onClick={() => void cropIt(source)} className="h-8 px-3">Crop again</Button>
              <Button type="button" variant="ghost" onClick={() => input.current?.click()} className="h-8 px-3">Choose a different image</Button>
            </div>
          </div>
        </div>
      )}

      <Field id="up-alt" label="Description (alt text)" value={alt} onChange={setAlt} maxLength={200} hint="Describe the picture for people using screen readers, e.g. “Plate of misal pav with lime”." />
      {localError && <Notice tone="error">{localError}</Notice>}
      <ActionMessage message={message} />
      <Button type="button" disabled={busy || !ready} onClick={() => void submit()} className="h-10 px-5">{busy ? "Uploading…" : "Upload image"}</Button>
      {cropper.dialog}
    </div>
  );
}

export function MediaLibrary() {
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { data, error, loading, reload } = useAdminQuery<{ assets: MediaAsset[]; storage: "local" | "cloudinary" }>("/media", { refreshMs: 0, onUnauthorized });

  return (
    <div className="space-y-6">
      {data?.storage === "local" && (
        <Notice tone="warn">Images are being saved on this computer’s disk (development mode). Before launch, set up Cloudinary so uploads survive restarts.</Notice>
      )}
      <Card title="Upload">
        <UploadForm onUploaded={reload} />
      </Card>
      {error && !data ? (
        <Notice tone="error">{error}</Notice>
      ) : loading ? (
        <div className="h-40 skeleton rounded-md" aria-busy aria-label="Loading images" />
      ) : data && data.assets.length === 0 ? (
        <Notice>No images yet. Upload your first one above.</Notice>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.assets.map((a) => <AssetCard key={a.id} asset={a} onChanged={reload} />)}
        </ul>
      )}
    </div>
  );
}

function AssetCard({ asset, onChanged }: { asset: MediaAsset; onChanged: () => void }) {
  const [alt, setAlt] = useState(asset.altText);
  const replaceInput = useRef<HTMLInputElement>(null);
  const cropper = useImageCropper();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, message, run } = useAction();
  const used = usageText(asset.usage);
  const isBundled = asset.url.startsWith("/images/"); // seeded placeholder shipped with the site

  async function replace(f: File | undefined) {
    if (!f) return;
    const problem = precheckImage(f);
    if (problem) return void run(async () => { throw new Error(problem); });
    const cropped = await cropper.crop(f, "library");
    if (replaceInput.current) replaceInput.current.value = "";
    if (!cropped) return; // cancelled
    const form = new FormData();
    form.set("file", cropped);
    if (await run(() => adminUpload<MediaAsset>(`/media/${asset.id}/file`, form, "PUT"), "Image replaced everywhere it’s used")) onChanged();
  }

  return (
    <li className="space-y-3 rounded-md border border-border bg-card p-4">
      <Thumb asset={{ url: asset.url, altText: alt }} />
      <Field id={`alt-${asset.id}`} label="Description (alt text)" value={alt} onChange={setAlt} maxLength={200} />
      <p className="text-xs text-muted-foreground">
        {sizeLabel(asset.bytes)} {used ? `· Used by ${used}` : "· Not used anywhere"}
      </p>
      <ActionMessage message={message} />
      {cropper.dialog}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || alt === asset.altText} onClick={() => void run(() => adminApi(`/media/${asset.id}`, { method: "PATCH", json: { altText: alt } }), "Description saved").then(onChanged)} className="h-9 px-3">Save description</Button>
        {!isBundled && (
          <>
            <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Replacement image for ${asset.altText || "image"}`} onChange={(e) => void replace(e.target.files?.[0])} />
            <Button variant="outline" disabled={busy} onClick={() => replaceInput.current?.click()} className="h-9 px-3">Replace image</Button>
          </>
        )}
        {used ? (
          <span className="self-center text-xs text-muted-foreground">Can’t delete while in use</span>
        ) : confirmDelete ? (
          <Button disabled={busy} onClick={() => void run(() => adminApi(`/media/${asset.id}`, { method: "DELETE" }), "Deleted").then(onChanged)} className="h-9 bg-destructive px-3 text-white hover:bg-destructive/90">Confirm delete</Button>
        ) : (
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)} className="h-9 px-3 text-destructive hover:text-destructive">Delete</Button>
        )}
      </div>
    </li>
  );
}

/** Pick an image from the library or upload a new one. */
export function MediaPicker({ label, value, onChange, purpose = "library" }: { label: string; purpose?: CropPurpose; value: { id: string; url: string; altText: string } | null; onChange: (a: { id: string; url: string; altText: string } | null) => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  // Only fetch the library once the picker is opened.
  const { data, error, reload } = useAdminQuery<{ assets: MediaAsset[] }>("/media", { refreshMs: 0, enabled: open, onUnauthorized });
  const choose = (a: MediaAsset) => {
    onChange({ id: a.id, url: a.url, altText: a.altText });
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {value ? <Thumb asset={value} className="w-24 shrink-0" /> : <div className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">No image</div>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-9 px-3">{value ? "Change image" : "Choose image"}</Button>
          {value && <Button type="button" variant="ghost" onClick={() => onChange(null)} className="h-9 px-3 text-destructive hover:text-destructive">Remove</Button>}
        </div>
      </div>
      {open && (
        <div className="space-y-4 rounded-md border border-border bg-background p-4">
          {error && !data ? <Notice tone="error">{error}</Notice> : null}
          <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {data?.assets.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => choose(a)} aria-label={`Use ${a.altText || "this image"}`} className={cn("block w-full rounded-md border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-ring", value?.id === a.id ? "border-primary" : "border-transparent hover:border-border")}>
                  <Thumb asset={a} />
                </button>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm text-primary">Upload a new image</summary>
            <div className="mt-3">
              <UploadForm purpose={purpose} onUploaded={(a) => { reload(); choose(a); }} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
