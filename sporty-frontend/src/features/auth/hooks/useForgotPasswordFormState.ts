"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/context/auth-context";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useForgotPasswordFormState() {
  const { forgotPassword, actionLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!email.trim()) {
      setEmailError("Email is required.");
      setSubmitError("");
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      setSubmitError("");
      return;
    }

    setEmailError("");
    setSubmitError("");

    const result = await forgotPassword(email);
    if (!result.success) {
      setIsSubmitted(false);
      setSuccessMessage("");
      setSubmitError(
        result.error ??
          "Unable to send reset email right now. Please try again.",
      );
      return;
    }

    setSuccessMessage(
      result.message ??
        "If an account exists with that email, you'll receive a reset link.",
    );
    setIsSubmitted(true);
  };

  return {
    email,
    setEmail,
    emailError,
    submitError,
    successMessage,
    isSubmitted,
    isSubmitting: actionLoading.forgotPassword,
    onSubmit,
  };
}
