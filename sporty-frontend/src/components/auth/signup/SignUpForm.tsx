"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { PasswordStrengthIndicator } from "@/components/auth/shared/PasswordStrengthIndicator";
import { useSignUpFormState } from "@/features/auth";
import { Divider } from "@/components/auth/login/components/Divider";
import { SocialLogin } from "@/components/auth/login/components/SocialLogin";

const FIELD_CLASS =
  "h-11 w-full rounded-[3px] border border-white/12 bg-surface-2 pl-10 pr-12 text-sm text-fg-1 placeholder:text-fg-3 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";
const LABEL_CLASS =
  "mb-1.5 block font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2";
const ICON_CLASS =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3";

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
          title="Join the Community"
          subtitle="Build your squad and compete every matchday."
          bullets={[
            "10,000+ active managers",
            "3 sports · 50+ leagues",
            "Daily matchups",
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-fg-1 hover:no-underline"
        >
          ← Back to Home
        </Link>

        <div className="animate-fade-in mt-5 overflow-hidden card-surface">
          <div className="space-y-2.5 p-8 pb-4">
            <span className="section-label">Create Account</span>
            <h1 className="font-bebas text-5xl leading-none tracking-[3px] text-fg-1">
              Create Account
            </h1>
            <p className="text-sm text-fg-2">
              Start your fantasy sports journey today.
            </p>
          </div>

          <div className="space-y-5 p-8 pt-2">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className={LABEL_CLASS}>
                  Username
                </label>
                <div className="relative">
                  <User className={ICON_CLASS} />
                  <input
                    id="username"
                    type="text"
                    placeholder="your-username"
                    autoComplete="username"
                    {...registerField("username")}
                    className={FIELD_CLASS}
                  />
                </div>
                {formState.errors.username?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.username.message}
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Email
                </label>
                <div className="relative">
                  <Mail className={ICON_CLASS} />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    {...registerField("email")}
                    className={FIELD_CLASS}
                  />
                </div>
                {formState.errors.email?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.email.message}
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="password" className={LABEL_CLASS}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={ICON_CLASS} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...registerField("password")}
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-3 transition-colors hover:text-accent"
                    aria-label={showPassword ? "Hide password" : "Show password"}
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

              <div>
                <label htmlFor="confirmPassword" className={LABEL_CLASS}>
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2 className={ICON_CLASS} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...registerField("confirmPassword")}
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-3 transition-colors hover:text-accent"
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
                className="h-11 w-full rounded-[3px] active:scale-[0.98] disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <p className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-accent hover:text-accent-bright hover:no-underline"
              >
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}
