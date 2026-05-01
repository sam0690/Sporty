"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { LoginSchema, type LoginValues } from "@/lib/validations";
import { toastifier } from "@/libs/toastifier";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

export function LoginForm() {
  const router = useRouter();
  const { login, actionLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const isSubmitting = actionLoading.login;

  const onSubmit = handleSubmit(async (values) => {
    const result = await login(values.identifier, values.password);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to sign in.");
      return;
    }

    router.replace("/dashboard");
  });

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm font-medium text-secondary transition-colors hover:text-black"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-28 rounded-full bg-accent/25 blur-2xl" />

      <Card className="animate-fade-in w-full rounded-xl border border-accent/20 bg-white shadow-strong">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="font-display text-base font-bold">Sporty</span>
          </div>
          <CardTitle className="font-display text-3xl font-bold text-black sm:text-4xl">
            Sign in
          </CardTitle>
          <p className="text-sm text-secondary">
            Sign in to your fantasy sports account
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1 block text-sm font-medium text-black"
              >
                Email or Username
              </label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Email or username"
                  autoComplete="username"
                  error={errors.identifier?.message}
                  className="h-12 rounded-md border border-border bg-white px-4 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  {...register("identifier")}
                />
              </div>
            </div>

            <div className="relative">
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-black"
              >
                Password
              </label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary/60"
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
                  className="h-12 w-full rounded-md border border-border bg-white px-4 pl-10 pr-14 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password?.message && (
                <span className="mt-1 block text-xs text-danger">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary transition-colors hover:text-[#035c3d] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-md text-base font-semibold shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
                  Please wait
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <Divider />
          <SocialLogin />

          <div className="border-t border-accent/20 pt-4 text-center text-sm text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary hover:text-[#035c3d] hover:underline"
            >
              Create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
