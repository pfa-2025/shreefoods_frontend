import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { PagesManager } from "@/features/admin/cms/pages-manager";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "Pages" };

export default function Page() {
  return (
    <AdminGate ownerOnly>
      <AdminPage title="Pages" intro="Edit page text and how each page appears in Google and when shared.">
        <PagesManager />
      </AdminPage>
    </AdminGate>
  );
}
