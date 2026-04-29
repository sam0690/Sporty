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
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
          >
            ← Back to Home
          </Link>
        </div>

        <Card className="animate-fade-in w-full rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
            <div className="flex items-center gap-2 text-primary-800">
              <span className="text-lg" aria-hidden="true">
                ⚽🏀🏏
              </span>
              <span className="text-base font-semibold">Sporty</span>
            </div>
            <CardTitle className="text-3xl font-bold text-primary-800 sm:text-4xl">
              Create your account
            </CardTitle>
            <p className="text-sm text-text-secondary">
              Start your fantasy sports journey today
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm font-medium text-text-primary"
                >
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your-username"
                  autoComplete="username"
                  error={errors.username?.message}
                  className="rounded-2xl border-border-light/80 bg-surface-50/80 px-5 py-3.5 text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
                  {...registerField("username")}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-text-primary"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    className="h-12 rounded-xl border border-gray-300 bg-white px-4 pl-10 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30"
                    {...registerField("email")}
                  />
                </div>
              </div>

              <div className="relative">
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-text-primary"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...registerField("password")}
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pl-10 pr-14 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-primary-600"
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
                  <span className="mt-1 block text-xs text-accent-red">
                    {errors.password.message}
                  </span>
                )}
                <PasswordStrengthIndicator password={password ?? ""} />
              </div>

              <div className="relative">
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm font-medium text-text-primary"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...registerField("confirmPassword")}
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pl-10 pr-14 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-primary-600"
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
                  <span className="mt-1 block text-xs text-accent-red">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl border border-[#1e6785] bg-[#247BA0]! px-6 text-base font-semibold text-white! shadow-md transition-all duration-200 hover:bg-[#1e6785]! hover:shadow-lg active:scale-[0.98] disabled:bg-[#247BA0]/70! disabled:text-white!"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <Divider />
            <SocialLogin />

            <p className="border-t border-gray-200 pt-4 text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
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
