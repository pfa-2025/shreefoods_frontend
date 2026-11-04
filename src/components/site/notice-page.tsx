import Link from "next/link";
import { PageHeader } from "@/components/site/section";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Honest stand-in for flows that are built in a later module. Has no fake actions. */
export function NoticePage({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <p className="fade-in max-w-lg text-muted-foreground" style={{ "--d": "0.05s" } as React.CSSProperties}>{message}</p>
        <Link href="/menu" className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-6")}>
          Browse the menu
        </Link>
      </div>
    </>
  );
}
