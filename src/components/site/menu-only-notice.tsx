import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown at /cart and /checkout while the admin has switched the site to menu-only. */
export function MenuOnlyNotice() {
  return (
    <div role="status">
      <p className="max-w-lg text-muted-foreground">Online ordering isn’t available right now. You’re welcome to browse our menu.</p>
      <Link href="/menu" className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-6")}>
        Browse the menu
      </Link>
    </div>
  );
}
