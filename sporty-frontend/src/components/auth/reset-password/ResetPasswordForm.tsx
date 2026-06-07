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
      <Card className="animate-fade-in mx-auto w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] ">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-barlow-condensed text-base font-700">Sporty</span>
          </div>
          <CardTitle className="font-bebas text-5xl text-[#f0f0f0] sm:text-4xl">
            Create new password
          </CardTitle>
          <p className="text-sm text-[#f0f0f0]/65">
            Your new password must be different from previous
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          {!token && (
            <p className="rounded-[3px] border border-warning/20 bg-warning/10 p-3 text-sm text-[#f0f0f0]">
              Invalid or missing reset token.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <label
                htmlFor="newPassword"
                className="mb-1 block text-sm text-[#f0f0f0]"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f0f0f0]/40" />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 pl-10 pr-14 text-base text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 focus:border-[rgba(232,251,37,0.3)] focus:outline-none focus:border-[#e8fb25] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f0f0f0]/40 transition-colors hover:text-[#e8fb25]"
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
                className="mb-1 block text-sm text-[#f0f0f0]"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f0f0f0]/40" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 pl-10 pr-14 text-base text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 focus:border-[rgba(232,251,37,0.3)] focus:outline-none focus:border-[#e8fb25] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f0f0f0]/40 transition-colors hover:text-[#e8fb25]"
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
              className="h-12 w-full rounded-[3px] text-base font-600 shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <p className="border-t border-[rgba(255,255,255,0.08)] pt-4 text-center text-sm text-[#555560]">
            <Link
              href="/login"
              className="font-600 text-[#e8fb25] hover:text-accent-secondary hover:underline"
            >
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
