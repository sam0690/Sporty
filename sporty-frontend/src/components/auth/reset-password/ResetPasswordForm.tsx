"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthCard, AuthLink } from "@/components/auth/shared/AuthCard";
import { AuthTextField, ButtonSpinner } from "@/components/auth/shared/AuthTextField";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { PasswordStrengthIndicator } from "@/components/auth/shared/PasswordStrengthIndicator";
import { useResetPasswordFormState } from "@/features/auth";

export function ResetPasswordForm() {
  const {
    token,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    errors,
    isSubmitting,
    onSubmit,
  } = useResetPasswordFormState();

  return (
    <AuthPageShell
      hero={
        <AuthHeroImage
          title="Password Requirements"
          subtitle="Use a strong and memorable password to protect your account."
          bullets={[
            "Minimum 8 characters",
            "At least one number",
            "At least one letter",
          ]}
        />
      }
    >
      <AuthCard
        title="Create new password"
        description="At least 8 characters, with a letter and a number."
      >
        {!token && (
          <p className="rounded-[3px] border border-warning/25 bg-warning/8 p-3 text-sm text-warning">
            Invalid or missing reset token.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <AuthTextField
            id="newPassword"
            label="New Password"
            icon={<Lock />}
            error={errors.newPassword}
            reveal={{
              shown: showPassword,
              onToggle: () => setShowPassword((prev) => !prev),
              subject: "new password",
            }}
            inputProps={{
              type: showPassword ? "text" : "password",
              value: newPassword,
              onChange: (event) => setNewPassword(event.target.value),
              placeholder: "Enter new password",
              autoComplete: "new-password",
            }}
          >
            <PasswordStrengthIndicator password={newPassword} />
          </AuthTextField>

          <AuthTextField
            id="confirmPassword"
            label="Confirm New Password"
            icon={<CheckCircle2 />}
            error={errors.confirmPassword}
            reveal={{
              shown: showConfirmPassword,
              onToggle: () => setShowConfirmPassword((prev) => !prev),
              subject: "confirm password",
            }}
            inputProps={{
              type: showConfirmPassword ? "text" : "password",
              value: confirmPassword,
              onChange: (event) => setConfirmPassword(event.target.value),
              placeholder: "Confirm new password",
              autoComplete: "new-password",
            }}
          />

          <Button
            type="submit"
            className="h-11 w-full rounded-[3px]"
            disabled={isSubmitting || !token}
          >
            {isSubmitting ? (
              <ButtonSpinner label="Resetting..." />
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        <p className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
          <AuthLink href="/login">← Back to Login</AuthLink>
        </p>
      </AuthCard>
    </AuthPageShell>
  );
}
