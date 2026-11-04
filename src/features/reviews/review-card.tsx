import { Stars } from "@/components/reviews/stars";
import type { PublicReview } from "@/types/review";

export function ReviewCard({ review: r, restaurantName }: { review: PublicReview; restaurantName: string }) {
  return (
    <article className="flex h-full flex-col rounded-md border border-border bg-card p-5">
      <Stars value={r.rating} size="size-5" />
      {r.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{r.comment}</p>}
      <p className="mt-auto pt-4 text-sm">
        <span className="font-medium">{r.displayName}</span>
        <span className="text-muted-foreground"> · {new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })} · Verified order</span>
      </p>
      {r.reply && (
        <div className="mt-3 rounded-md bg-secondary px-4 py-3 text-sm">
          <p className="font-medium">Reply from {restaurantName}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.reply}</p>
        </div>
      )}
    </article>
  );
}

export function RatingSummary({ average, count }: { average: number; count: number }) {
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span className="font-display text-5xl text-primary tabular-nums">{average.toFixed(1)}</span>
      <Stars value={average} size="size-6" />
      <span className="text-sm text-muted-foreground">from {count} verified {count === 1 ? "review" : "reviews"}</span>
    </p>
  );
}
