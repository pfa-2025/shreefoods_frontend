import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/admin/auth-forms";

// The reset token is in the URL: keep it out of Referer headers.
export const metadata: Metadata = { title: "Set new password", referrer: "no-referrer" };
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
