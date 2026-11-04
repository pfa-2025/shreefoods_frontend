import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { SettingsManager } from "@/features/admin/cms/settings-manager";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <AdminGate ownerOnly>
      <AdminPage title="Settings" intro="Restaurant details, opening hours, ordering, tax and the payment QR code.">
        <SettingsManager />
      </AdminPage>
    </AdminGate>
  );
}
