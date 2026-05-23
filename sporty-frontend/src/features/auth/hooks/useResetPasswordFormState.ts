"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/lib/toastifier";

type ResetErrors = {
  newPassword?: string;
  confirmPassword?: string;
};

export function useResetPasswordFormState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, actionLoading } = useAuth();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ResetErrors>({});

  const validate = (): boolean => {
    const nextErrors: ResetErrors = {};

    if (!newPassword.trim()) {
      nextErrors.newPassword = "New password is required.";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "Password must be at least 8 characters.";
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!token) {
      toastifier.error("Reset token is missing.");
      return;
    }

    if (!validate()) {
      return;
    }

    const result = await resetPassword(token, newPassword);
    if (!result.success) {
      toastifier.error(result.error ?? "Unable to reset password.");
      return;
    }

    toastifier.success("Password reset successful. Please sign in.");
    router.push("/login");
  };

  return {
    token,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    errors,
    isSubmitting: actionLoading.resetPassword,
    onSubmit,
  };
}
