"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui";
import { useLoginFormState } from "@/features/auth";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

export function LoginForm() {
  const { register, formState, showPassword, setShowPassword, isSubmitting, onSubmit } =
    useLoginFormState();

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="mb-5">
        <Link
          href="/"
          className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0] hover:no-underline"
        >
          ← Back to Home
        </Link>
      </div>

      <Card className="animate-fade-in w-full">
        <CardHeader className="space-y-3 p-8 pb-4">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-2xl tracking-[3px] text-[#e8fb25]">
              SPORTY
            </span>
          </div>
          <h1 className="font-bebas text-5xl tracking-[3px] text-[#f0f0f0]">
            Sign In
          </h1>
          <p className="text-sm text-[#555560]">
            Sign in to your fantasy sports account
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1 block font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#f0f0f0]"
              >
                Email or Username
              </label>
              <input
                id="identifier"
                type="text"
                placeholder="Email or username"
                autoComplete="username"
                {...register("identifier")}
                className="h-11 w-full rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[#111117] px-4 text-sm text-[#f0f0f0] placeholder:text-[#555560] transition-colors focus:border-[#e8fb25] focus:outline-none"
              />
              {formState.errors.identifier?.message && (
                <span className="mt-1 block text-xs text-[#ff3b30]">
                  {formState.errors.identifier.message}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#f0f0f0]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...register("password")}
                  className="h-11 w-full rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[#111117] px-4 pr-12 text-sm text-[#f0f0f0] placeholder:text-[#555560] transition-colors focus:border-[#e8fb25] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555560] transition-colors hover:text-[#f0f0f0]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formState.errors.password?.message && (
                <span className="mt-1 block text-xs text-[#ff3b30]">
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
              className="h-11 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f]" />
                  Please wait
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <Divider />
          <SocialLogin />

          <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 text-center text-sm text-[#555560]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] hover:text-[#f0ff45] hover:no-underline"
            >
              Create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
