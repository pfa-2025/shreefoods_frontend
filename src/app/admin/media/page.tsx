import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { MediaLibrary } from "@/features/admin/cms/media-library";
import { AdminPage } from "@/features/admin/cms/ui";

export const metadata: Metadata = { title: "Images" };

export default function Page() {
  return (
    <AdminGate ownerOnly>
      <AdminPage title="Images" intro="Upload photos once and reuse them on the menu, announcements and page previews." wide>
        <MediaLibrary />
      </AdminPage>
    </AdminGate>
  );
}
