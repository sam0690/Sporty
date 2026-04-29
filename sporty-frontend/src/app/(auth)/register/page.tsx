import { SignUpForm } from "@/components/auth/signup";
import { GuestOnlyRoute } from "@/components/auth/GuestOnlyRoute";

export default function RegisterPage() {
  return (
    <GuestOnlyRoute>
      <SignUpForm />
    </GuestOnlyRoute>
  );
}
