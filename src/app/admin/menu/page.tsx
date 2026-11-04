import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { MenuManager } from "@/features/admin/cms/menu-manager";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "Menu" };

export default function Page() {
  return (
    <AdminGate>
      <AdminPage title="Menu" intro="Add sections and dishes, change prices and photos, and mark dishes unavailable when you run out." wide>
        <MenuManager />
      </AdminPage>
    </AdminGate>
  );
}
