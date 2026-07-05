"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/auth-context";
import { RegisterSchema, type RegisterValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";
import { getSafeRedirectPath } from "@/lib/route.utils";

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

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await register(values.username, values.email, values.password);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to create account.");
      return;
    }

    toastifier.success("Account created! Welcome to Sporty.");
    const redirect = getSafeRedirectPath(
      new URLSearchParams(window.location.search).get("redirect"),
    );
    router.replace(redirect ?? "/dashboard");
  });

  return {
    ...form,
    password,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isSubmitting: actionLoading.register,
    onSubmit,
  };
}
