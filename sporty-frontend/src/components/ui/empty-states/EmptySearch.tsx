"use client";

import { SearchX } from "lucide-react";

export function EmptySearch() {
  return (
    <section className="flex flex-col items-center py-16 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <SearchX className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        No results found
      </h3>
      <p className="mt-1 text-sm text-ink-muted">Try searching for something else</p>
    </section>
  );
}
