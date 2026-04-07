"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/libs/toastifier";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

type LoginErrors = {
  username?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const { login, actionLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  const isSubmitting = actionLoading.login;

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};

    if (!username.trim()) {
      nextErrors.username = "Username is required.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const result = await login(username, password);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to sign in.");
      return;
    }

    router.replace("/dashboard");
  };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-primary-200/40 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-28 rounded-full bg-accent-basketball/25 blur-2xl" />

      <Card className="animate-fade-in w-full rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <CardHeader className="space-y-2 p-8 pb-4 sm:p-10 sm:pb-4">
          <div className="flex items-center gap-2 text-primary-800">
            <span className="text-lg" aria-hidden="true">
              ⚽🏀🏏
            </span>
            <span className="text-base font-semibold">Sporty</span>
          </div>
          <CardTitle className="text-3xl font-bold text-primary-800 sm:text-4xl">
            Sign in
          </CardTitle>
          <p className="text-sm text-text-secondary">
            Sign in to your fantasy sports account
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-8 pt-0 sm:p-10 sm:pt-0">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Username
              </label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                  aria-hidden="true"
                >
                  @
                </span>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  error={errors.username}
                  className="h-12 rounded-xl border border-gray-300 bg-white px-4 pl-10 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30"
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
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                  aria-hidden="true"
                >
                  *
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 pl-10 pr-14 text-base text-text-primary placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-primary-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="mt-1 block text-xs text-accent-red">
                  {errors.password}
                </span>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl border border-[#1e6785] bg-[#247BA0]! px-6 text-base font-semibold text-white! shadow-md transition-all duration-200 hover:bg-[#1e6785]! hover:shadow-lg active:scale-[0.98] disabled:bg-[#247BA0]/70! disabled:text-white!"
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

          <div className="border-t border-gray-200 pt-4 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/signUp"
              className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              Create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
