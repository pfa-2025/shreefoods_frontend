/**
 * Image cropping: the maths (pure, unit-tested) and the canvas rendering (browser only).
 * The server still re-checks every upload by its real file contents, so nothing here is a security boundary.
 */

/** The server's upload limit (5 MB). Cropped images are shrunk to fit under it. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Originals may be bigger than the upload limit because they are shrunk before sending. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export type CropPurpose = "library" | "dish" | "announcement" | "qr" | "share";
export type AspectId = "original" | "1:1" | "4:3" | "3:2" | "16:9" | "4:5" | "1.91:1";

export const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "1:1", label: "Square 1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "Wide 16:9", ratio: 16 / 9 },
  { id: "4:5", label: "Tall 4:5", ratio: 4 / 5 },
  { id: "1.91:1", label: "Share 1.91:1", ratio: 1.91 },
];

export interface PurposeConfig {
  aspect: AspectId;
  /** Longest side of the saved image in pixels. Photos are never enlarged, only shrunk. */
  maxEdge: number;
  /** JPEG for photos (small); PNG for QR codes (sharp edges, no compression blur). */
  type: "image/jpeg" | "image/png";
  tip: string;
}

export const PURPOSES: Record<CropPurpose, PurposeConfig> = {
  library: { aspect: "original", maxEdge: 2000, type: "image/jpeg", tip: "Crop to the part of the picture you want to keep, or leave it as it is." },
  dish: { aspect: "4:3", maxEdge: 1600, type: "image/jpeg", tip: "Dishes appear as 4:3 on the menu, and as squares or tall cards in a few places, so keep the dish near the middle." },
  announcement: { aspect: "4:5", maxEdge: 1600, type: "image/jpeg", tip: "What’s New cards are tall (4:5). Keep the important part near the middle." },
  qr: { aspect: "1:1", maxEdge: 1200, type: "image/png", tip: "Keep the WHOLE QR code in the frame, including its white border. Cutting off any edge can stop it scanning." },
  share: { aspect: "1.91:1", maxEdge: 1600, type: "image/jpeg", tip: "Link previews (WhatsApp, Facebook, Google) use a wide 1.91:1 image. Keep any text well inside the frame." },
};

/** The size of an image's bounding box after rotating it by `deg` degrees. Exact for quarter turns. */
export function rotatedSize(width: number, height: number, deg: number): { width: number; height: number } {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0 || d === 180) return { width, height };
  if (d === 90 || d === 270) return { width: height, height: width };
  const rad = (d * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { width: cos * width + sin * height, height: sin * width + cos * height };
}

/** Final pixel size: the crop, scaled down (never up) so its longest side is at most `maxEdge`. */
export function outputSize(cropW: number, cropH: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(cropW, cropH));
  return { width: Math.max(1, Math.round(cropW * scale)), height: Math.max(1, Math.round(cropH * scale)) };
}

/** Width ÷ height for the crop frame. "Original" follows the picture itself, including after a quarter turn. */
export function aspectValue(id: AspectId, natural: { width: number; height: number } | null, rotation: number): number {
  const fixed = ASPECTS.find((a) => a.id === id)?.ratio;
  if (fixed) return fixed;
  if (!natural) return 4 / 3;
  const r = rotatedSize(natural.width, natural.height, rotation);
  return r.width / r.height;
}

export const formatBytes = (b: number): string => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t create the image."))), type, quality));

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn’t be opened as a picture."));
    img.src = src;
  });

/**
 * Draws the chosen area (in rotated-image pixel coordinates, as the cropper reports them) into a new image.
 * Renders straight into a canvas of the FINAL size, so even a 50-megapixel photo never needs a giant intermediate canvas.
 * If the result is over `maxBytes`, quality and then size are reduced until it fits.
 */
export async function renderCrop(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation: number,
  opts: { maxEdge: number; type: "image/jpeg" | "image/png"; maxBytes: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const rot = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  let size = outputSize(crop.width, crop.height, opts.maxEdge);
  let quality = opts.type === "image/jpeg" ? 0.9 : undefined;

  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn’t prepare the image.");
    ctx.fillStyle = "#ffffff"; // transparent areas become white (JPEG has no transparency)
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = "high";
    ctx.scale(size.width / crop.width, size.height / crop.height);
    ctx.translate(-crop.x, -crop.y);
    ctx.translate(rot.width / 2, rot.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.drawImage(image, 0, 0);

    const blob = await toBlob(canvas, opts.type, quality);
    if (blob.size <= opts.maxBytes) return { blob, width: size.width, height: size.height };
    if (quality && quality > 0.65) quality = Math.round((quality - 0.1) * 100) / 100;
    else size = { width: Math.max(1, Math.round(size.width * 0.8)), height: Math.max(1, Math.round(size.height * 0.8)) };
  }
  throw new Error("That image is too detailed to shrink under the upload limit. Try cropping tighter.");
}
