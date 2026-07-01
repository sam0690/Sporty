"use client";

import { Trophy } from "lucide-react";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center py-12 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Trophy className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <p className="text-ink-muted">{message}</p>
      <button
        type="button"
        className="mt-5 rounded-sm bg-primary px-5 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-on-primary transition-colors hover:bg-primary-hover"
      >
        Invite Friends
      </button>
    </section>
  );
}
