"use client";

import { ErrorState } from "@/components/ui";

type AdminErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function AdminErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: AdminErrorStateProps) {
  return <ErrorState title={message} onRetry={onRetry} />;
}
