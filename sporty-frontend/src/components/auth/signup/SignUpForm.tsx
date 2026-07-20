"use client";

import { CheckCircle2, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthCard, AuthLink } from "@/components/auth/shared/AuthCard";
import { AuthTextField, ButtonSpinner } from "@/components/auth/shared/AuthTextField";
import { AuthHeroImage } from "@/components/auth/shared/AuthHeroImage";
import { AuthPageShell } from "@/components/auth/shared/AuthPageShell";
import { PasswordStrengthIndicator } from "@/components/auth/shared/PasswordStrengthIndicator";
import { useSignUpFormState } from "@/features/auth";
import { Divider } from "@/components/auth/login/components/Divider";
import { SocialLogin } from "@/components/auth/login/components/SocialLogin";

export function SignUpForm() {
  const {
    register: registerField,
    formState,
    password,
    usernameStatus,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isSubmitting,
    onSubmit,
  } = useSignUpFormState();

  return (
    <AuthPageShell
      hero={
        <AuthHeroImage
          title="Join the League"
          subtitle="Build your squad and compete every matchday."
          bullets={[
            "Budget or draft leagues",
            "Live matchday points",
            "Head-to-head matchups",
          ]}
        />
      }
    >
      <AuthCard
        title="Create Account"
        description="Start managing a squad in minutes."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthTextField
            id="username"
            label="Username"
            icon={<User />}
            error={formState.errors.username?.message}
            inputProps={{
              type: "text",
              placeholder: "your-username",
              autoComplete: "username",
              ...registerField("username"),
            }}
          >
            {usernameStatus === "checking" && (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-fg-3">
                <Loader2 className="size-3.5 animate-spin" />
                Checking availability…
              </span>
            )}
            {usernameStatus === "available" && (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="size-3.5" />
                Username is available
              </span>
            )}
          </AuthTextField>

          <AuthTextField
            id="email"
            label="Email"
            icon={<Mail />}
            error={formState.errors.email?.message}
            inputProps={{
              type: "email",
              placeholder: "name@example.com",
              autoComplete: "email",
              ...registerField("email"),
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
              placeholder: "Create a password",
              autoComplete: "new-password",
              ...registerField("password"),
            }}
          >
            <PasswordStrengthIndicator password={password ?? ""} />
          </AuthTextField>

          <AuthTextField
            id="confirmPassword"
            label="Confirm Password"
            icon={<CheckCircle2 />}
            error={formState.errors.confirmPassword?.message}
            reveal={{
              shown: showConfirmPassword,
              onToggle: () => setShowConfirmPassword((prev) => !prev),
              subject: "confirm password",
            }}
            inputProps={{
              type: showConfirmPassword ? "text" : "password",
              placeholder: "Confirm your password",
              autoComplete: "new-password",
              ...registerField("confirmPassword"),
            }}
          />

          <Button
            type="submit"
            className="h-11 w-full rounded-[3px]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ButtonSpinner label="Creating account..." />
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <Divider />
        <SocialLogin />

        <p className="border-t border-white/8 pt-4 text-center text-sm text-fg-2">
          Already have an account? <AuthLink href="/login">Sign in →</AuthLink>
        </p>
      </AuthCard>
    </AuthPageShell>
  );
}
