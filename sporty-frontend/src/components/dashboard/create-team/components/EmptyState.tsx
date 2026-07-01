"use client";

import { Shield } from "lucide-react";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface py-12 text-center">
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Shield className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="font-condensed text-sm font-bold uppercase tracking-[0.06em] text-ink-muted">
        {message}
      </p>
    </section>
  );
}
