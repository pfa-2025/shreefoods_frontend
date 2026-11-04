import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { NewsManager } from "@/features/admin/cms/news-manager";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "What’s New" };

export default function Page() {
  return (
    <AdminGate ownerOnly>
      <AdminPage title="What’s New" intro="Announcements on the home page. Drafts stay hidden until you publish them.">
        <NewsManager />
      </AdminPage>
    </AdminGate>
  );
}
