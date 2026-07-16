"use client";

import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthCard, AuthLink } from "@/components/auth/shared/AuthCard";
import { AuthTextField, ButtonSpinner } from "@/components/auth/shared/AuthTextField";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { useLoginFormState } from "@/features/auth";
import { Divider } from "./components/Divider";
import { SocialLogin } from "./components/SocialLogin";

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
      <AuthCard
        title="Sign In"
        description="Sign in to your fantasy sports account."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthTextField
            id="identifier"
            label="Email or Username"
            icon={<User />}
            error={formState.errors.identifier?.message}
            inputProps={{
              type: "text",
              placeholder: "Email or username",
              autoComplete: "username",
              ...register("identifier"),
            }}
          />

          <AuthTextField
            id="password"
            label="Password"
            icon={<Lock />}
            error={formState.errors.password?.message}
            reveal={{
              shown: showPassword,
              onToggle: () => setShowPassword((prev) => !prev),
            }}
            inputProps={{
              type: showPassword ? "text" : "password",
              placeholder: "Enter your password",
              autoComplete: "current-password",
              ...register("password"),
            }}
          />

          <div className="flex justify-end">
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-[3px]"
            disabled={isSubmitting}
          >
            {isSubmitting ? <ButtonSpinner label="Please wait" /> : "Sign In"}
          </Button>
        </form>

        <Divider />
        <SocialLogin />

        <div className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
          Don&apos;t have an account?{" "}
          <AuthLink href="/register">Create account</AuthLink>
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}
