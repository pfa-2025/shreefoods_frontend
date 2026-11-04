import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { ReviewsManager } from "@/features/admin/cms/reviews-manager";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return (
    <AdminGate ownerOnly>
      <AdminPage title="Reviews" intro="Approve, hide, reply to or delete customer reviews. Only approved reviews appear on the website.">
        <ReviewsManager />
      </AdminPage>
    </AdminGate>
  );
}
