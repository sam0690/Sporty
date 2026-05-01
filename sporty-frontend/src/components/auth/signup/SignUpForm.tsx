"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useAuth } from "@/context/auth-context";
import { RegisterSchema, type RegisterValues } from "@/lib/validations";
import { toastifier } from "@/libs/toastifier";
import { Divider } from "@/components/auth/login/components/Divider";
import { SocialLogin } from "@/components/auth/login/components/SocialLogin";

export function SignUpForm() {
  const router = useRouter();
  const { register, actionLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    control,
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const isSubmitting = actionLoading.register;
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(async (values) => {
    const result = await register(
      values.username,
      values.email,
      values.password,
    );
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to create account.");
      return;
    }

    toastifier.success("Account created! Welcome to Sporty.");
    router.replace("/dashboard");
  });

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
            className="text-sm font-medium text-secondary transition-colors hover:text-black"
          >
            ← Back to Home
          </Link>
        </div>

        <Card className="animate-fade-in w-full rounded-xl border border-accent/20 bg-white shadow-strong">
          <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-lg" aria-hidden="true">
                ⚽🏀🏏
              </span>
              <span className="font-display text-base font-bold">Sporty</span>
            </div>
            <CardTitle className="font-display text-3xl font-bold text-black sm:text-4xl">
              Create your account
            </CardTitle>
            <p className="text-sm text-secondary">
              Start your fantasy sports journey today
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm font-medium text-black"
                >
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your-username"
                  autoComplete="username"
                  error={errors.username?.message}
                  className="rounded-md border-border bg-white px-4 py-3 text-black placeholder:text-secondary/60 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  {...registerField("username")}
                />
              </div>

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
                    placeholder="name@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    className="h-12 rounded-md border border-border bg-white px-4 pl-10 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/40"
                    {...registerField("email")}
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
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...registerField("password")}
                    className="h-12 w-full rounded-md border border-border bg-white px-4 pl-10 pr-14 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-primary"
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
                {errors.password?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {errors.password.message}
                  </span>
                )}
                <PasswordStrengthIndicator password={password ?? ""} />
              </div>

              <div className="relative">
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm font-medium text-black"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...registerField("confirmPassword")}
                    className="h-12 w-full rounded-md border border-border bg-white px-4 pl-10 pr-14 text-base text-black placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-primary"
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
                {errors.confirmPassword?.message && (
                  <span className="mt-1 block text-xs text-danger">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-md text-base font-semibold shadow-card hover:shadow-hover transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F4F4F9]/30 border-t-[#F4F4F9]" />
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
                className="font-semibold text-primary hover:text-[#035c3d] hover:underline"
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
