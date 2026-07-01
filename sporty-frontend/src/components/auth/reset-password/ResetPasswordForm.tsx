"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
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
      <Card className="animate-fade-in mx-auto w-full max-w-md">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <span className="kicker">Sporty</span>
          <CardTitle className="text-4xl sm:text-5xl">Create new password</CardTitle>
          <p className="text-sm text-ink-muted">
            Your new password must be different from previous
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          {!token && (
            <p className="rounded-md border border-warning/20 bg-warning-soft p-3 text-sm font-medium text-warning">
              Invalid or missing reset token.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <label
                htmlFor="newPassword"
                className="mb-1.5 block font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-4 pl-10 pr-14 text-base text-ink placeholder:text-ink-faint transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-primary"
                  aria-label={
                    showPassword ? "Hide new password" : "Show new password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <span className="mt-1 block text-xs text-danger">
                  {errors.newPassword}
                </span>
              )}
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            <div className="relative">
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-4 pl-10 pr-14 text-base text-ink placeholder:text-ink-faint transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-primary"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="mt-1 block text-xs text-danger">
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base disabled:opacity-60"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <p className="border-t border-border pt-4 text-center text-sm text-ink-muted">
            <Link
              href="/login"
              className="font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:text-primary-hover hover:no-underline"
            >
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
