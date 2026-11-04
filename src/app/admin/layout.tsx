import type { Metadata } from "next";
import { MotionProvider } from "@/components/motion/providers";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Shree Foods Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </MotionProvider>
  );
}
