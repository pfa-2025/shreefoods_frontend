"use client";

import { m } from "motion/react";
import { EASE } from "./ease";

type Tag = "div" | "ul" | "ol" | "dl" | "section";
type ItemTag = "div" | "li" | "article";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

/** A group whose children (<StaggerItem>) appear one after another when the group scrolls into view. */
export function Stagger({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: Tag }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -40px 0px" }}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: ItemTag }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
}
