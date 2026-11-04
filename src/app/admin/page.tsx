import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { DashboardView } from "@/features/admin/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminPage() {
  return (
    <AdminGate>
      <DashboardView />
    </AdminGate>
  );
}
