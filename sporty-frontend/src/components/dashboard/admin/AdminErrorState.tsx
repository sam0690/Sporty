"use client";

import { Button } from "@/components/ui/Button";

type AdminErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function AdminErrorState({ message = "Something went wrong loading this data.", onRetry }: AdminErrorStateProps) {
  return (
    <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[#111117] p-5 flex items-center justify-between gap-4">
      <p className="text-sm text-[#ff3b30]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
