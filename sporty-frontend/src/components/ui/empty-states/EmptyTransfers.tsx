"use client";

import { SearchX } from "lucide-react";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] text-[#555560]">
        <SearchX className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-[#f0f0f0]">
        No players found
      </h3>
      <p className="mt-1 text-sm text-[#555560]">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-6 rounded-[3px] border border-[rgba(255,255,255,0.08)] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0]"
      >
        Clear Filters
      </button>
    </section>
  );
}
