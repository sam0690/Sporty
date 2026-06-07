"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react";
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
import { PasswordStrengthIndicator } from "@/components/auth/shared/PasswordStrengthIndicator";
import { useSignUpFormState } from "@/features/auth";
import { Divider } from "@/components/auth/login/components/Divider";
import { SocialLogin } from "@/components/auth/login/components/SocialLogin";

export function SignUpForm() {
  const {
    register: registerField,
    formState,
    password,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isSubmitting,
    onSubmit,
  } = useSignUpFormState();

  return (
    <AuthPageShell
      hero={
        <AuthHeroImage
          title="Join the Fantasy Sports Community"
          subtitle="Build your squad and compete every matchday."
          bullets={[
            "10,000+ Active Managers",
            "3 Sports | 50+ Leagues",
            "Daily Matchups",
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-[#555560] transition-colors hover:text-[#f0f0f0]"
          >
            ← Back to Home
          </Link>
        </div>

        <Card className="animate-fade-in w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] ">
          <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-lg" aria-hidden="true">
                ⚽🏀🏏
              </span>
              <span className="font-barlow-condensed text-base font-700">Sporty</span>
            </div>
            <CardTitle className="font-bebas text-5xl text-[#f0f0f0] sm:text-4xl">
              Create your account
            </CardTitle>
            <p className="text-sm text-[#f0f0f0]/65">
              Start your fantasy sports journey today
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm text-[#f0f0f0]"
                >
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your-username"
                  autoComplete="username"
                    error={formState.errors.username?.message}
                  className="rounded-[3px] border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 transition-all duration-200 focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
                  {...registerField("username")}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm text-[#f0f0f0]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f0f0f0]/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    error={formState.errors.email?.message}
                    className="h-12 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 pl-10 text-base text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
                    {...registerField("email")}
                  />
                </div>
              </div>

              <div className="relative">
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm text-[#f0f0f0]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f0f0f0]/40" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...registerField("password")}
                    className="h-12 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 pl-10 pr-14 text-base text-[#f0f0f0] placeholder:text-[#f0f0f0]/40 focus:border-[rgba(232,251,37,0.3)] focus:outline-none focus:border-[#e8fb25] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f0f0f0]/40 transition-colors hover:text-[#e8fb25]"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {formState.errors.password?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.password.message}
                  </span>
                )}
                <PasswordStrengthIndicator password={password ?? ""} />
              </div>

              <div className="relative">
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm text-[#f0f0f0]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f0f0f0]/40" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...registerField("confirmPassword")}
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
                {formState.errors.confirmPassword?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.confirmPassword.message}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-[3px] text-base font-600 shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <p className="border-t border-accent/20 pt-4 text-center text-sm text-secondary">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-600 text-[#e8fb25] hover:text-accent-secondary hover:underline"
              >
                Sign in →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  );
}
