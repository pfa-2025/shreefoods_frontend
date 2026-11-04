"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24">
      <h1 className="font-display text-4xl text-primary">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">Please try again. If it keeps happening, call us.</p>
      <Button onClick={reset} className="mt-6 h-11 px-6">
        Try again
      </Button>
    </div>
  );
}
