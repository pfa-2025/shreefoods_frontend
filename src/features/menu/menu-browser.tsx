"use client";

import { m } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { AddToCart } from "@/features/cart/add-to-cart";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory } from "@/types/menu";

export function MenuBrowser({ categories, ordersOpen }: { categories: MenuCategory[]; ordersOpen: boolean }) {
  const [active, setActive] = useState<string>("all");
  const visible = active === "all" ? categories : categories.filter((c) => c.slug === active);
  const tabs = [{ slug: "all", name: "All" }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))];

  return (
    <>
      <div
        role="group"
        aria-label="Filter menu by category"
        className="sticky top-16 z-30 -mx-6 mb-10 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm"
      >
        {tabs.map((t) => (
          <button
            key={t.slug}
            type="button"
            aria-pressed={active === t.slug}
            onClick={() => setActive(t.slug)}
            className={cn(
              "shrink-0 rounded-md border px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active === t.slug ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {!ordersOpen && (
        <p role="status" className="mb-8 rounded-md border border-border bg-secondary px-4 py-3 text-sm">
          Online ordering is currently closed. You can still browse the menu.
        </p>
      )}

      {/* A new key remounts the list at once (no overlap with the old one); the new dishes fade and cascade in. */}
      <m.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="space-y-20">
          {visible.map((cat) => (
            <section key={cat.id} aria-labelledby={`h-${cat.slug}`}>
              <h2 id={`h-${cat.slug}`} className="mb-8 font-display text-4xl text-primary">
                {cat.name}
              </h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing in this section yet.</p>
              ) : (
                <Stagger as="ul" className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.items.map((item) => (
                    <StaggerItem as="li" key={item.id} className="group flex flex-col">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAlt}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className={cn("object-cover transition-transform duration-700 ease-out group-hover:scale-105", !item.isAvailable && "opacity-50 grayscale")}
                          />
                        )}
                      </div>
                      <div className="mt-3 flex items-baseline justify-between gap-4">
                        <h3 className="font-display text-2xl">{item.name}</h3>
                        <span className="text-sm tabular-nums">{formatUsd(item.priceCents)}</span>
                      </div>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">{item.description}</p>
                      {item.dietaryLabels.length > 0 && (
                        <p className="mt-2 text-xs uppercase tracking-wider text-gold-text">{item.dietaryLabels.join(" · ")}</p>
                      )}
                      <div className="mt-4 flex items-center gap-3">
                        <AddToCart
                          itemId={item.id}
                          name={item.name}
                          disabled={!item.isAvailable || !ordersOpen}
                          disabledLabel={!item.isAvailable ? "Unavailable" : "Orders closed"}
                        />
                        {!item.isAvailable && <span className="text-sm font-medium text-destructive">Currently unavailable</span>}
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </section>
          ))}
      </m.div>
    </>
  );
}
