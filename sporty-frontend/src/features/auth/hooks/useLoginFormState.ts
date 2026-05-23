"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/auth-context";
import { LoginSchema, type LoginValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";

export function useLoginFormState() {
  const router = useRouter();
  const { login, actionLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await login(values.identifier, values.password);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to sign in.");
      return;
    }

    router.replace("/dashboard");
  });

  return {
    ...form,
    showPassword,
    setShowPassword,
    isSubmitting: actionLoading.login,
    onSubmit,
  };
}
