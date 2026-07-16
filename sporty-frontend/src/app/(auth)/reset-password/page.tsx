import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-fg-1">
          <div className="h-8 w-8 animate-spin rounded-[3px] border-2 border-white/20 border-t-accent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
