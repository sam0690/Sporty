import { ForgotPasswordForm } from "@/components/auth/forgot-password";
import { GuestOnlyRoute } from "@/components/auth/GuestOnlyRoute";

export default function ForgotPasswordPage() {
  return (
    <GuestOnlyRoute>
      <ForgotPasswordForm />
    </GuestOnlyRoute>
  );
}
