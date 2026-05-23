"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { useLoginFormState } from "@/features/auth";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

export function LoginForm() {
  const { register, formState, showPassword, setShowPassword, isSubmitting, onSubmit } =
    useLoginFormState();

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-foreground"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-accent-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-28 rounded-full bg-accent-secondary/20 blur-2xl" />

      <Card className="animate-fade-in w-full rounded-3xl border-white/10 bg-surface/90 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-accent-primary">
            <span className="text-lg" aria-hidden="true">
              ●
            </span>
            <span className="font-display text-base font-bold tracking-[0.18em] uppercase">
              Sporty
            </span>
          </div>
          <CardTitle className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Sign in
          </CardTitle>
          <p className="text-sm text-slate-400">
            Sign in to your fantasy sports account
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1 block text-sm font-medium text-slate-100"
              >
                Email or Username
              </label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Email or username"
                  autoComplete="username"
                  error={formState.errors.identifier?.message}
                  className="h-12 rounded-xl border border-white/10 bg-surface-strong px-4 text-base text-foreground placeholder:text-slate-500 focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/30"
                  {...register("identifier")}
                />
              </div>
            </div>

            <div className="relative">
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-100"
              >
                Password
              </label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
                  aria-hidden="true"
                >
                  *
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...register("password")}
                  className="h-12 w-full rounded-xl border border-white/10 bg-surface-strong px-4 pl-10 pr-14 text-base text-foreground placeholder:text-slate-500 transition-all duration-200 focus:border-accent-primary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-accent-primary"
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
                <span className="mt-1 block text-xs text-red-400">
                  {formState.errors.password.message}
                </span>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-accent-primary transition-colors hover:text-cyan-300 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-full text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Please wait
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <Divider />
          <SocialLogin />

          <div className="border-t border-white/10 pt-4 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-accent-primary hover:text-cyan-300 hover:underline"
            >
              Create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
