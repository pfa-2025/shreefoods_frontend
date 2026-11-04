import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export function Section({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("mx-auto max-w-6xl px-6 py-16 md:py-24", className)} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  hrefLabel,
  id,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  id?: string;
}) {
  return (
    <Reveal className="mb-10 flex items-end justify-between gap-6">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-gold-text">{eyebrow}</p>}
        <h2 id={id} className="font-display text-4xl text-primary md:text-5xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm text-primary underline-offset-4 hover:underline">
          {hrefLabel ?? "View all"}
        </Link>
      )}
    </Reveal>
  );
}

export function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mx-auto max-w-6xl px-6 pb-4 pt-16 md:pt-24">
      <h1 className="fade-in font-display text-5xl text-primary md:text-6xl">{title}</h1>
      {intro && <p className="fade-in mt-4 max-w-xl text-muted-foreground" style={{ "--d": "0.05s" } as React.CSSProperties}>{intro}</p>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rise rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorState({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  );
}
