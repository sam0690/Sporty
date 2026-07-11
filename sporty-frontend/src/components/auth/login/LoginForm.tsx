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
  "h-11 w-full rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[#0d0d12] px-4 text-sm text-[#f0f0f0] placeholder:text-[#555560] transition-colors focus:border-[#e8fb25] focus:outline-none focus:ring-2 focus:ring-[rgba(232,251,37,0.15)]";
const LABEL_CLASS =
  "mb-1.5 block font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5]";

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
          className="inline-flex items-center gap-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0] hover:no-underline"
        >
          ← Back to Home
        </Link>

        <div className="animate-fade-in mt-5 overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
          <div className="space-y-2.5 p-8 pb-4">
            <span className="section-label">Sign In</span>
            <h1 className="font-bebas text-5xl leading-none tracking-[3px] text-[#f0f0f0]">
              Sign In
            </h1>
            <p className="text-sm text-[#9a9aa5]">
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
                  <span className="mt-1 block text-xs text-[#ff3b5c]">
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555560] transition-colors hover:text-[#e8fb25]"
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
                  <span className="mt-1 block text-xs text-[#ff3b5c]">
                    {formState.errors.password.message}
                  </span>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] transition-colors hover:text-[#f0ff45] hover:no-underline"
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
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f]" />
                    Please wait
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 text-center text-sm text-[#9a9aa5]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] hover:text-[#f0ff45] hover:no-underline"
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
