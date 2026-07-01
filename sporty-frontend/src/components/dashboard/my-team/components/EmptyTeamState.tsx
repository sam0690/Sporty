"use client";

import { Users } from "lucide-react";

export function EmptyTeamState() {
  return (
    <section className="surface flex flex-col items-center px-6 py-14 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Users className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        No team in this league yet
      </h3>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Select another league or build a squad for this one when you&apos;re
        ready.
      </p>
    </section>
  );
}
