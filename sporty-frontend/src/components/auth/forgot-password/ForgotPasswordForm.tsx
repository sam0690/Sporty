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
      <Card className="animate-fade-in mx-auto w-full max-w-md">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <span className="kicker">Sporty</span>
          <CardTitle className="text-4xl sm:text-5xl">Forgot password?</CardTitle>
          <p className="text-sm text-ink-muted">
            No worries, we&apos;ll send you reset instructions
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  error={emailError}
                  className="h-12 pl-10 text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          {isSubmitted && (
            <p className="rounded-md border border-success/20 bg-success-soft p-3 text-sm font-medium text-success">
              {successMessage}
            </p>
          )}

          {submitError && (
            <p className="rounded-md border border-danger/20 bg-danger-soft p-3 text-sm font-medium text-danger">
              {submitError}
            </p>
          )}

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
