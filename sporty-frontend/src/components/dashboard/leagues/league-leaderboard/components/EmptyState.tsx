"use client";

import { Trophy } from "lucide-react";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="surface flex flex-col items-center py-12 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Trophy className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <p className="text-ink-muted">{message}</p>
    </section>
  );
}
