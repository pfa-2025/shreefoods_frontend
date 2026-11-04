"use client";

import { m } from "motion/react";
import { EASE } from "./ease";

type Direction = "up" | "down" | "left" | "right" | "none";

const offset = (d: Direction, n: number) => ({ x: d === "left" ? n : d === "right" ? -n : 0, y: d === "up" ? n : d === "down" ? -n : 0 });

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Where it comes from: "left" slides in from the left. */
  direction?: Direction;
  distance?: number;
}

/** Fades and slides in once, as it scrolls into view. Honours the visitor's reduced-motion setting. */
export function Reveal({ children, className, delay = 0, direction = "up", distance = 16 }: RevealProps) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, ...offset(direction, distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
