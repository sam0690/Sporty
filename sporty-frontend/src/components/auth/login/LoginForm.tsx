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
  "h-11 w-full rounded-[3px] border border-white/12 bg-surface-2 px-4 text-sm text-fg-1 placeholder:text-fg-3 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";
const LABEL_CLASS =
  "mb-1.5 block font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2";

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
          className="inline-flex items-center gap-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-fg-1 hover:no-underline"
        >
          ← Back to Home
        </Link>

        <div className="animate-fade-in mt-5 overflow-hidden card-surface">
          <div className="space-y-2.5 p-8 pb-4">
            <span className="section-label">Sign In</span>
            <h1 className="font-bebas text-5xl leading-none tracking-[3px] text-fg-1">
              Sign In
            </h1>
            <p className="text-sm text-fg-2">
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
                  <span className="mt-1 block text-xs text-danger">
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
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-accent transition-colors hover:text-accent-bright hover:no-underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-[3px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
                    Please wait
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <div className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-accent hover:text-accent-bright hover:no-underline"
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
