"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthCard, AuthLink } from "@/components/auth/shared/AuthCard";
import { AuthTextField, ButtonSpinner } from "@/components/auth/shared/AuthTextField";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { useForgotPasswordFormState } from "@/features/auth";

export function ForgotPasswordForm() {
  const {
    email,
    setEmail,
    emailError,
    submitError,
    successMessage,
    isSubmitted,
    isSubmitting,
    onSubmit,
  } = useForgotPasswordFormState();

  return (
    <AuthPageShell
      hero={
        <AuthHeroImage
          title="Remember your password?"
          subtitle="Head back to login and continue managing your fantasy teams."
          bullets={["Quick account access", "Secure sign-in experience"]}
        />
      }
    >
      <AuthCard
        title="Forgot password?"
        description="Enter your email and we'll send reset instructions."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthTextField
            id="email"
            label="Email"
            icon={<Mail />}
            error={emailError}
            inputProps={{
              type: "email",
              value: email,
              onChange: (event) => setEmail(event.target.value),
              placeholder: "name@example.com",
              autoComplete: "email",
            }}
          />

          <Button
            type="submit"
            className="h-11 w-full rounded-[3px]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ButtonSpinner label="Sending..." />
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        {isSubmitted && (
          <p className="rounded-[3px] border border-success/25 bg-success/8 p-3 text-sm text-success">
            {successMessage}
          </p>
        )}

        {submitError && (
          <p className="rounded-[3px] border border-danger/25 bg-danger/8 p-3 text-sm text-danger-soft">
            {submitError}
          </p>
        )}

        <p className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
          <AuthLink href="/login">← Back to Login</AuthLink>
        </p>
      </AuthCard>
    </AuthPageShell>
  );
}
