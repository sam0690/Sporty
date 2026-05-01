"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
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
import { useAuth } from "@/context/auth-context";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const { forgotPassword, actionLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isSubmitting = actionLoading.forgotPassword;

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!email.trim()) {
      setEmailError("Email is required.");
      setSubmitError("");
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      setSubmitError("");
      return;
    }

    setEmailError("");
    setSubmitError("");

    const result = await forgotPassword(email);
    if (!result.success) {
      setIsSubmitted(false);
      setSuccessMessage("");
      setSubmitError(
        result.error ??
        "Unable to send reset email right now. Please try again.",
      );
      return;
    }

    setSuccessMessage(
      result.message ??
      "If an account exists with that email, you'll receive a reset link.",
    );
    setIsSubmitted(true);
  };

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
      <Card className="animate-fade-in mx-auto w-full max-w-md rounded-xl border border-accent/20 bg-white shadow-strong">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-display text-base font-bold">Sporty</span>
          </div>
          <CardTitle className="font-display text-3xl font-bold text-black sm:text-4xl">
            Forgot password?
          </CardTitle>
          <p className="text-sm text-secondary">
            No worries, we&apos;ll send you reset instructions
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-black"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  error={emailError}
                  className="h-12 rounded-md border border-border bg-white px-4 pl-10 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/40"
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
            <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary">
              {successMessage}
            </p>
          )}

          {submitError && (
            <p className="rounded-md border border-danger/20 bg-danger/5 p-3 text-sm font-medium text-danger">
              {submitError}
            </p>
          )}

          <p className="border-t border-accent/20 pt-4 text-center text-sm text-secondary">
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-[#035c3d] hover:underline"
            >
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
