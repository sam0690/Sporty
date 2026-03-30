"use client";

import { useEffect } from "react";
import { toastifier } from "@/libs/toastifier";

type TransferSuccessProps = {
  status: "success" | "error" | null;
  message: string;
  token: number;
};

export function TransferSuccess({
  status,
  message,
  token,
}: TransferSuccessProps) {
  useEffect(() => {
    if (!status || !message || token === 0) {
      return;
    }

    if (status === "success") {
      toastifier.success(`✓ ${message}`);
      return;
    }

    toastifier.error(`✕ ${message}`);
  }, [status, message, token]);

  return null;
}
