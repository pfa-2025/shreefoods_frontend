import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating. Announced as text ("4 out of 5 stars"), the icons themselves are decorative. */
export function Stars({ value, size = "size-4", className }: { value: number; size?: string; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={`${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`} className={cn("inline-flex gap-0.5 text-gold-text", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cn(size, n <= rounded ? "fill-current" : "fill-transparent opacity-60")} />
      ))}
    </span>
  );
}
