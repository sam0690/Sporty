"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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

    router.push("/dashboard");
  };

  return (
    <Card className="animate-fade-in-scale animate-float mx-auto w-full max-w-md rounded-3xl border border-border-light/60 bg-surface-50/85 shadow-xl shadow-primary-500/10 backdrop-blur-xl transition-shadow hover:shadow-2xl hover:shadow-primary-500/20">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Welcome Back
        </CardTitle>
        <p className="mx-auto max-w-sm text-sm text-text-secondary">
          Sign in to continue building your dream fantasy squad.
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
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your-username"
              autoComplete="username"
              error={errors.username}
              className="rounded-2xl border-border-light/80 bg-surface-50/80 px-5 py-3.5 text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
            />
          </div>

          <div className="relative">
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl border border-border-light/80 bg-surface-50/80 px-5 pr-14 text-sm text-text-primary placeholder:text-text-secondary transition-all duration-300 focus:-translate-y-0.5 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-[2.35rem] -translate-y-1/2 text-text-secondary transition-colors hover:text-primary-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            {errors.password && (
              <span className="mt-1 block text-xs text-accent-red">
                {errors.password}
              </span>
            )}
          </div>

          <Button
            type="submit"
            className="ripple-effect relative w-full overflow-hidden rounded-full bg-gradient-to-r from-primary-500 to-secondary-600 px-8 py-3 font-semibold tracking-wide text-text-light shadow-lg shadow-primary-500/20 transition-all hover:from-primary-600 hover:to-secondary-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-light/30 border-t-text-light" />
                Please wait
              </span>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <Divider />
        <SocialLogin />

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href="/forgot-password"
            className="group relative font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            Forgot password?
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-primary-600 transition-all duration-300 group-hover:left-0 group-hover:w-full group-hover:translate-x-0" />
          </Link>
          <Link
            href="/signUp"
            className="group relative font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            Create account
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-primary-600 transition-all duration-300 group-hover:left-0 group-hover:w-full group-hover:translate-x-0" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
