import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/admin-gate";
import { LiveBoard } from "@/features/admin/live/live-board";

export const metadata: Metadata = { title: "Live orders" };

export default function LiveOrdersPage() {
  return (
    <AdminGate>
      <LiveBoard />
    </AdminGate>
  );
}
