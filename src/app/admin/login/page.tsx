import type { Metadata } from "next";
import { LoginForm } from "@/features/admin/auth-forms";

export const metadata: Metadata = { title: "Sign in" };
export default function Page() {
  return <LoginForm />;
}
