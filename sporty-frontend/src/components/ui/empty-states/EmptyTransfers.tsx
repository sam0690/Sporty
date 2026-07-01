"use client";

import { SearchX } from "lucide-react";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="flex flex-col items-center py-16 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <SearchX className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        No players found
      </h3>
      <p className="mt-1 text-sm text-ink-muted">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 inline-flex items-center rounded-sm border-[1.5px] border-border-strong bg-surface px-6 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink hover:bg-surface-muted"
      >
        Clear Filters
      </button>
    </section>
  );
}
