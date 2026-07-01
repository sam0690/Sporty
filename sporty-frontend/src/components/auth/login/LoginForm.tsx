"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { useLoginFormState } from "@/features/auth";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

const FIELD_CLASS =
  "h-11 w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-4 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const LABEL_CLASS =
  "mb-1.5 block font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted";

export function LoginForm() {
  const {
    register,
    formState,
    showPassword,
    setShowPassword,
    isSubmitting,
    onSubmit,
  } = useLoginFormState();

  return (
    <AuthPageShell
      hero={
        <AuthHeroImage
          title="Welcome Back, Manager"
          subtitle="Your squad is waiting. Pick up right where you left off."
          bullets={[
            "Live matchday points",
            "3 sports, one squad",
            "Weekly leaderboards",
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink hover:no-underline"
        >
          ← Back to Home
        </Link>

        <div className="animate-fade-in mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="space-y-2.5 p-8 pb-4">
            <span className="kicker">Sign In</span>
            <h1 className="font-condensed text-5xl font-bold uppercase leading-none tracking-[0.01em] text-ink">
              Sign In
            </h1>
            <p className="text-sm text-ink-muted">
              Sign in to your fantasy sports account.
            </p>
          </div>

          <div className="space-y-5 p-8 pt-2">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="identifier" className={LABEL_CLASS}>
                  Email or Username
                </label>
                <input
                  id="identifier"
                  type="text"
                  placeholder="Email or username"
                  autoComplete="username"
                  {...register("identifier")}
                  className={FIELD_CLASS}
                />
                {formState.errors.identifier?.message && (
                  <span className="mt-1 block text-xs font-medium text-danger">
                    {formState.errors.identifier.message}
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="password" className={LABEL_CLASS}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register("password")}
                    className={`${FIELD_CLASS} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-primary"
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
                  <span className="mt-1 block text-xs font-medium text-danger">
                    {formState.errors.password.message}
                  </span>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:text-primary-hover hover:no-underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="h-11 w-full shadow-hard-red transition-transform hover:-translate-y-0.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />
                    Please wait
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <div className="border-t border-border pt-4 text-center text-sm text-ink-muted">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:text-primary-hover hover:no-underline"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}
