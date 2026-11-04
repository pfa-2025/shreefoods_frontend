"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/** Moves its content slightly slower than the page while scrolling. Content is scaled up a touch so no edge ever shows. */
export function Parallax({ children, className, distance = 36 }: { children: React.ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <div ref={ref} className={className}>
      <m.div style={{ y, scale: 1.12 }} className="size-full">
        {children}
      </m.div>
    </div>
  );
}
