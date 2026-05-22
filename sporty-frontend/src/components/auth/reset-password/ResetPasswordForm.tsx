"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/lib/toastifier";

type ResetErrors = {
  newPassword?: string;
  confirmPassword?: string;
};

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, actionLoading } = useAuth();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ResetErrors>({});

  const isSubmitting = actionLoading.resetPassword;

  const validate = (): boolean => {
    const nextErrors: ResetErrors = {};

    if (!newPassword.trim()) {
      nextErrors.newPassword = "New password is required.";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "Password must be at least 8 characters.";
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!token) {
      toastifier.error("Reset token is missing.");
      return;
    }

    if (!validate()) {
      return;
    }

    const result = await resetPassword(token, newPassword);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to reset password.");
      return;
    }

    toastifier.success("Password reset successful. Please sign in.");
    router.push("/login");
  };

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
      <Card className="animate-fade-in mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-surface/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-display text-base font-bold">Sporty</span>
          </div>
          <CardTitle className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Create new password
          </CardTitle>
          <p className="text-sm text-foreground/65">
            Your new password must be different from previous
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          {!token && (
            <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-sm font-medium text-foreground">
              Invalid or missing reset token.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <label
                htmlFor="newPassword"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-md border border-white/10 bg-white/5 px-4 pl-10 pr-14 text-base text-foreground placeholder:text-foreground/40 focus:border-accent-primary/30 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-accent-primary"
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
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-md border border-white/10 bg-white/5 px-4 pl-10 pr-14 text-base text-foreground placeholder:text-foreground/40 focus:border-accent-primary/30 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-accent-primary"
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
              className="h-12 w-full rounded-md text-base font-semibold shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <p className="border-t border-white/10 pt-4 text-center text-sm text-foreground/60">
            <Link
              href="/login"
              className="font-semibold text-accent-primary hover:text-accent-secondary hover:underline"
            >
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
