"use client";

import { SearchX } from "lucide-react";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="card-surface py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
        <SearchX className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-fg-1">
        No players found
      </h3>
      <p className="mt-1 text-sm text-fg-3">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-6 rounded-[3px] border border-white/8 px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1"
      >
        Clear Filters
      </button>
    </section>
  );
}
