import { LoginForm } from "@/components/auth/login";
import { GuestOnlyRoute } from "@/components/auth/GuestOnlyRoute";

export default function LoginPage() {
  return (
    <GuestOnlyRoute>
      <LoginForm />
    </GuestOnlyRoute>
  );
}
