"use client";

import { AnimatePresence, m } from "motion/react";

/** A form error that eases open (and closed) instead of making the form jump. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.p
          key={message}
          id={id}
          className="overflow-hidden text-sm text-destructive"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
        >
          <span className="block pt-1">{message}</span>
        </m.p>
      )}
    </AnimatePresence>
  );
}
