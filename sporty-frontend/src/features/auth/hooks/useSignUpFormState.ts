"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/auth-context";
import { RegisterSchema, type RegisterValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";
import { UserService } from "@/services/UserService";

export type UsernameStatus = "idle" | "checking" | "available" | "taken";
import {
  buildFavouritesOnboardingUrl,
  getSafeRedirectPath,
} from "@/lib/route.utils";

export function useSignUpFormState() {
  const router = useRouter();
  const { register, actionLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const username = useWatch({ control: form.control, name: "username" }) ?? "";
  // Only the async result is stored; the visible status is derived below so we
  // never call setState synchronously inside the effect.
  const [checkResult, setCheckResult] = useState<{
    value: string;
    available: boolean;
  } | null>(null);

  const trimmedUsername = username.trim();
  const formatValid = trimmedUsername.length >= 3 && trimmedUsername.length <= 50;
  const usernameStatus: UsernameStatus = !formatValid
    ? "idle"
    : checkResult?.value === trimmedUsername
      ? checkResult.available
        ? "available"
        : "taken"
      : "checking";

  // Live "is this username free?" check, debounced. A stale-response guard
  // drops results for a value the user has since edited past.
  useEffect(() => {
    if (!formatValid) {
      return;
    }
    const value = trimmedUsername;
    const timer = setTimeout(async () => {
      try {
        const available = await UserService.isUsernameAvailable(value);
        if (form.getValues("username").trim() !== value) {
          return; // input moved on — ignore this result
        }
        setCheckResult({ value, available });
        if (available) {
          form.clearErrors("username");
        } else {
          form.setError("username", {
            type: "manual",
            message: "That username is already taken.",
          });
        }
      } catch {
        // Network hiccup — don't block the user; the server re-checks on submit.
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [trimmedUsername, formatValid, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await register(values.username, values.email, values.password);
    if (!result.success) {
      const message = result.error ?? "Unable to create account.";
      if (/username/i.test(message)) {
        setCheckResult({ value: values.username.trim(), available: false });
        form.setError("username", { type: "manual", message });
      }
      toastifier.error(message);
      return;
    }

    toastifier.success("Account created! Welcome to Sporty.");
    const redirect = getSafeRedirectPath(
      new URLSearchParams(window.location.search).get("redirect"),
    );
    // Route through a one-time "pick your favourites" step before landing
    // wherever the user was actually headed — it's skippable there, not a
    // hard gate on completing registration.
    router.replace(buildFavouritesOnboardingUrl(redirect));
  });

  return {
    ...form,
    password,
    usernameStatus,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isSubmitting: actionLoading.register,
    onSubmit,
  };
}
