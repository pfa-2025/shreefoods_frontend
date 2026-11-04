"use client";

import { AnimatePresence, m } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EASE } from "@/components/motion/ease";
import { buttonVariants } from "@/components/ui/button-variants";
import { CartLink } from "@/features/cart/cart-link";
import { cn } from "@/lib/utils";

const links = [
  { href: "/menu", label: "Menu" },
  { href: "/our-story", label: "Our Story" },
  { href: "/reviews", label: "Reviews" },
  { href: "/affiliations", label: "Affiliations" },
  { href: "/contact", label: "Contact" },
  { href: "/track", label: "Track Order" },
];

const cta = cn(buttonVariants(), "h-10 px-5 text-sm");

// Has the page scrolled? (the header gains a soft shadow once content slides beneath it)
const subscribeScroll = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const isScrolled = () => window.scrollY > 8;

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const scrolled = useSyncExternalStore(subscribeScroll, isScrolled, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm transition-[box-shadow,border-color] duration-300", scrolled ? "border-border shadow-[0_6px_20px_-12px_rgba(40,30,10,0.25)]" : "border-border/70")}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-2xl font-medium tracking-wide text-primary transition-opacity hover:opacity-80"
        >
          Shree Foods
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(
                // underline grows from the left on hover, and stays for the current page
                "relative py-1 text-sm transition-colors hover:text-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-primary after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100",
                pathname === l.href ? "text-primary after:scale-x-100" : "text-foreground/80 after:scale-x-0",
              )}
            >
              {l.label}
            </Link>
          ))}
          <CartLink />
          <Link href="/menu" className={cta}>
            Order Now
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <CartLink />
          <button
            type="button"
            className="-mr-2 p-2"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span key={open ? "x" : "menu"} className="block" initial={{ rotate: -60, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 60, opacity: 0 }} transition={{ duration: 0.15 }}>
                {open ? <X /> : <Menu />}
              </m.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.nav
            id="mobile-nav"
            aria-label="Mobile"
            className="overflow-hidden border-t border-border bg-background md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <ul className="flex flex-col gap-1 px-6 py-4">
              {links.map((l, i) => (
                <m.li key={l.href} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.03 + i * 0.03, ease: EASE }}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === l.href ? "page" : undefined}
                    className="block py-3 text-lg"
                  >
                    {l.label}
                  </Link>
                </m.li>
              ))}
              <li className="pt-2">
                <Link
                  href="/menu"
                  onClick={() => setOpen(false)}
                  className={cn(cta, "w-full")}
                >
                  Order Now
                </Link>
              </li>
            </ul>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
