"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
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
      <Card className="animate-fade-in mx-auto w-full max-w-md card-surface ">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-sans text-base font-700">Sporty</span>
          </div>
          <CardTitle className="font-display text-5xl text-fg-1 sm:text-4xl">
            Forgot password?
          </CardTitle>
          <p className="text-sm text-fg-1/65">
            No worries, we&apos;ll send you reset instructions
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm text-fg-1"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-1/40" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  error={emailError}
                  className="h-12 rounded-[3px] border border-white/8 bg-surface-3 px-4 pl-10 text-base text-fg-1 placeholder:text-fg-1/40 focus:border-accent/30 focus:border-accent"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-[3px] text-base font-600 shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          {isSubmitted && (
            <p className="rounded-[3px] border border-accent/20 bg-accent/10 p-3 text-sm text-accent">
              {successMessage}
            </p>
          )}

          {submitError && (
            <p className="rounded-[3px] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {submitError}
            </p>
          )}

          <p className="border-t border-white/8 pt-4 text-center text-sm text-fg-3">
            <Link
              href="/login"
              className="font-600 text-accent hover:text-danger hover:underline"
            >
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
