"use client";

import { RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASPECTS, type AspectId, type CropPurpose, MAX_UPLOAD_BYTES, PURPOSES, aspectValue, formatBytes, loadImage, outputSize, renderCrop } from "./crop-image";

interface Props {
  file: File;
  /** Object URL for `file` (created and released by useImageCropper). */
  src: string;
  purpose: CropPurpose;
  onDone: (file: File) => void;
  onCancel: () => void;
}

/** The longest side of the turned working copy; the saved picture is never larger than the purpose's own limit anyway. */
const TURN_EDGE = 4000;

/**
 * Turns the picture ourselves instead of asking the cropping library to: its quarter-turn fitting leaves the crop frame
 * covering only part of a turned picture, so people could never select all of it. A turned copy makes the maths trivial.
 */
async function turned(src: string, quarters: number, type: "image/jpeg" | "image/png"): Promise<string> {
  const img = await loadImage(src);
  const swap = quarters % 2 === 1;
  const scale = Math.min(1, TURN_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser can’t turn pictures.");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((quarters * Math.PI) / 2);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, 0.95));
  if (!blob) throw new Error("Couldn’t turn the picture.");
  return URL.createObjectURL(blob);
}

function CropDialog({ file, src, purpose, onDone, onCancel }: Props) {
  const cfg = PURPOSES[purpose];
  const ref = useRef<HTMLDialogElement>(null);
  const [aspectId, setAspectId] = useState<AspectId>(cfg.aspect);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [quarters, setQuarters] = useState(0); // clockwise quarter turns, 0-3
  const [workSrc, setWorkSrc] = useState(src); // the picture being cropped: the original, or a turned copy of it
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A native modal dialog: focus is trapped inside, the page behind is inert, and Escape is handled below.
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const aspect = aspectValue(aspectId, natural, 0);
  const out = area ? outputSize(area.width, area.height, cfg.maxEdge) : null;
  const reframe = () => {
    setPos({ x: 0, y: 0 });
    setZoom(1);
  };

  // Build the turned copy whenever the number of turns changes, and release the previous copy.
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    (quarters === 0 ? Promise.resolve(src) : turned(src, quarters, cfg.type === "image/png" ? "image/png" : "image/jpeg"))
      .then((url) => {
        if (quarters !== 0) made = url;
        if (cancelled) {
          if (made) URL.revokeObjectURL(made);
        } else setWorkSrc(url);
      })
      .catch(() => !cancelled && setError("Couldn’t turn the picture. Please try again."));
    return () => {
      cancelled = true;
      // the copy may still be on screen for a moment while the next one is built, so release it a little later
      if (made) setTimeout(() => URL.revokeObjectURL(made!), 2000);
    };
  }, [quarters, src, cfg.type]);

  function turn(by: number) {
    setArea(null); // the old selection belongs to the old orientation
    setQuarters((q) => (q + by + 4) % 4);
    reframe();
  }

  async function confirm() {
    if (!area) return;
    setBusy(true);
    setError(null);
    try {
      const { blob } = await renderCrop(await loadImage(workSrc), area, 0, { maxEdge: cfg.maxEdge, type: cfg.type, maxBytes: MAX_UPLOAD_BYTES });
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60) || "image";
      onDone(new File([blob], `${base}-cropped.${cfg.type === "image/png" ? "png" : "jpg"}`, { type: cfg.type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t crop the image. Please try again.");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: we close it ourselves so the parent stays in step
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(95vw,52rem)] rounded-md border border-border bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 id="crop-title" className="font-display text-2xl text-primary">Crop image</h2>
          <p className="mt-1 text-sm text-muted-foreground">{cfg.tip}</p>
        </div>

        {loadFailed ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            That file couldn’t be opened as a picture. Please choose a JPEG, PNG or WebP image.
          </p>
        ) : (
          <div className="relative h-[min(52vh,460px)] overflow-hidden rounded-md bg-neutral-900" data-testid="crop-area">
            <Cropper
              image={workSrc}
              crop={pos}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              objectFit="contain"
              keyboardStep={20}
              onCropChange={setPos}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
              onMediaLoaded={(m) => setNatural({ width: m.naturalWidth, height: m.naturalHeight })}
              mediaProps={{ onError: () => setLoadFailed(true) }}
            />
          </div>
        )}

        {!loadFailed && (
          <>
            <div role="group" aria-label="Shape of the crop" className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={aspectId === a.id}
                  onClick={() => {
                    setAspectId(a.id);
                    reframe();
                  }}
                  className={cn("h-9 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring", aspectId === a.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-w-56 flex-1 items-center gap-3 text-sm">
                <span className="font-medium">Zoom</span>
                <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => turn(-1)} aria-label="Rotate left" className="h-9 px-3"><RotateCcw aria-hidden /></Button>
                <Button type="button" variant="outline" onClick={() => turn(1)} aria-label="Rotate right" className="h-9 px-3"><RotateCw aria-hidden /></Button>
                <Button type="button" variant="outline" onClick={() => { setQuarters(0); setAspectId(cfg.aspect); reframe(); }} className="h-9 px-3">Reset</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag the picture to move it, scroll or pinch to zoom. With the picture selected, the arrow keys move it.
              {out && <> <span data-testid="crop-result">Saved as {out.width}×{out.height} {cfg.type === "image/png" ? "PNG" : "JPEG"}</span> (smaller photos are never enlarged).</>}
            </p>
          </>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {file.size <= MAX_UPLOAD_BYTES && !loadFailed ? (
            <Button type="button" variant="ghost" onClick={() => onDone(file)} disabled={busy} className="h-10 px-3 text-muted-foreground">Use original file ({formatBytes(file.size)})</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-10 px-5">Cancel</Button>
            <Button type="button" onClick={() => void confirm()} disabled={busy || loadFailed || !area} className="h-10 px-5">{busy ? "Preparing…" : "Use this crop"}</Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

interface Request {
  file: File;
  src: string;
  purpose: CropPurpose;
  resolve: (f: File | null) => void;
}

/**
 * `const { crop, dialog } = useImageCropper()`, render `{dialog}` once, then `await crop(file, purpose)`:
 * resolves with the cropped file, or null if the person cancelled.
 */
export function useImageCropper() {
  const [req, setReq] = useState<Request | null>(null);

  const crop = useCallback(
    (file: File, purpose: CropPurpose = "library") =>
      new Promise<File | null>((resolve) => setReq({ file, purpose, src: URL.createObjectURL(file), resolve })),
    [],
  );

  const finish = (result: File | null) => {
    if (!req) return;
    URL.revokeObjectURL(req.src);
    req.resolve(result);
    setReq(null);
  };

  const dialog = req ? createPortal(<CropDialog key={req.src} file={req.file} src={req.src} purpose={req.purpose} onDone={finish} onCancel={() => finish(null)} />, document.body) : null;
  return { crop, dialog };
}
