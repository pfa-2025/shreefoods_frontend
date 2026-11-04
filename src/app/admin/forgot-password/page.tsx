import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/admin/auth-forms";

export const metadata: Metadata = { title: "Reset password" };
export default function Page() {
  return <ForgotPasswordForm />;
}
