"use client";

import { Shirt } from "lucide-react";

export function EmptyTeamState() {
  return (
    <section className="card-surface px-6 py-14 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full border border-white/8 text-fg-3">
        <Shirt className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-600 text-fg-1">
        You haven&apos;t created a team in this league yet.
      </h3>
      <p className="mt-2 text-sm text-fg-3">
        Select another league or build a squad for this one when you&apos;re
        ready.
      </p>
    </section>
  );
}
