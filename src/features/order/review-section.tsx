"use client";

import { useState } from "react";
import { Appear } from "@/components/motion/appear";
import { AnimatedStars } from "@/components/reviews/animated-stars";
import { StarInput } from "@/components/reviews/star-input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { ApiError, api } from "@/lib/api";
import type { PublicOrder } from "@/types/order";
import type { OwnReview } from "@/types/review";

const field =
  "mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive";

/** "How was your order?" Appears once the order is ready; one review per order. */
export function ReviewSection({ token, order, onSubmitted }: { token: string; order: PublicOrder; onSubmitted: (r: OwnReview) => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (order.review) {
    const r = order.review;
    return (
      <Appear key="thanks">
      <section aria-labelledby="review-h" className="rounded-md border border-border p-5">
        <h2 id="review-h" className="font-display text-2xl text-primary">Thanks for your review!</h2>
        <div className="mt-3 flex items-center gap-3"><AnimatedStars value={r.rating} size="size-5" /><span className="text-sm text-muted-foreground">as {r.displayName}</span></div>
        {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{r.comment}</p>}
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {r.visibility === "public" ? "Your review is shown on our Reviews page." : "We’ve received it. It will appear on our Reviews page once we’ve approved it."}
        </p>
        {r.reply && (
          <div className="mt-3 rounded-md bg-secondary px-4 py-3 text-sm">
            <p className="font-medium">Reply from {order.restaurantName}</p>
            <p className="mt-1 whitespace-pre-wrap">{r.reply}</p>
          </div>
        )}
      </section>
      </Appear>
    );
  }

  if (!order.canReview) {
    if (order.fulfillmentStatus === "CANCELLED") return null;
    return <p className="text-sm text-muted-foreground">You’ll be able to leave a review once your order is ready.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    if (!rating) return setErrors({ rating: "Please choose a star rating." });
    setBusy(true);
    try {
      onSubmitted(await api<OwnReview>(`/orders/${encodeURIComponent(token)}/review`, { method: "POST", json: { rating, comment, displayName: name } }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        setErrors(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
        setFormError("Please check the highlighted fields.");
      } else {
        setFormError(err instanceof ApiError ? err.message : "We couldn’t send your review. Please check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Appear key="form">
    <section aria-labelledby="review-h" className="rounded-md border border-border p-6">
      <h2 id="review-h" className="font-display text-2xl text-primary">How was your order?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your honest review helps other guests. We read every one.</p>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 space-y-4">
        <StarInput value={rating} onChange={setRating} error={errors.rating} />
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="review-comment" className="text-sm font-medium">Tell us more <span className="font-normal text-muted-foreground">(optional)</span></label>
            <span className="text-xs tabular-nums text-muted-foreground" aria-hidden>{comment.length}/500</span>
          </div>
          <textarea id="review-comment" rows={4} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={!!errors.comment} className={field} />
          <FieldError message={errors.comment} />
        </div>
        <div>
          <label htmlFor="review-name" className="text-sm font-medium">Name shown with your review <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input id="review-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Defaults to your first name and last initial" aria-invalid={!!errors.displayName} className={field} />
          <FieldError message={errors.displayName} />
        </div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" disabled={busy} className="h-11 px-6">{busy ? "Sending…" : "Send review"}</Button>
        <p className="text-xs text-muted-foreground">Reviews are checked before they appear on the website. Your email and phone number are never shown.</p>
      </form>
    </section>
    </Appear>
  );
}
