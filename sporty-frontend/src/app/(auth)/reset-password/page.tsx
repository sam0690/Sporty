import { ResetPasswordForm } from "@/components/auth/reset-password";
import { GuestOnlyRoute } from "@/components/auth/GuestOnlyRoute";

export default function ResetPasswordPage() {
  return (
    <GuestOnlyRoute>
      <ResetPasswordForm />
    </GuestOnlyRoute>
  );
}
