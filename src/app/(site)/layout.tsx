import { Suspense } from "react";
import { MotionProvider } from "@/components/motion/providers";
import { Footer } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <Suspense
        fallback={
          <header className="sticky top-0 z-40 h-16 border-b border-border/70 bg-background">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6 font-display text-2xl text-primary">Shree Foods</div>
          </header>
        }
      >
        <SiteHeader />
      </Suspense>
      {/* overflow-x: clip stops slide-in animations from briefly making the page wider than the screen (unlike "hidden", it keeps sticky headers working) */}
      <main id="main" className="flex-1 overflow-x-clip">
        {children}
      </main>
      <Suspense fallback={<div className="mt-24 h-64 bg-secondary/60" />}>
        <Footer />
      </Suspense>
    </MotionProvider>
  );
}
