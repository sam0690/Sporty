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
      <Card className="animate-fade-in mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-surface/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-display text-base font-bold">Sporty</span>
          </div>
          <CardTitle className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Forgot password?
          </CardTitle>
          <p className="text-sm text-foreground/65">
            No worries, we&apos;ll send you reset instructions
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  error={emailError}
                  className="h-12 rounded-md border border-white/10 bg-white/5 px-4 pl-10 text-base text-foreground placeholder:text-foreground/40 focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-md text-base font-semibold shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          {isSubmitted && (
            <p className="rounded-md border border-accent-primary/20 bg-accent-primary/10 p-3 text-sm font-medium text-accent-primary">
              {successMessage}
            </p>
          )}

          {submitError && (
            <p className="rounded-md border border-danger/20 bg-danger/5 p-3 text-sm font-medium text-danger">
              {submitError}
            </p>
          )}

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
