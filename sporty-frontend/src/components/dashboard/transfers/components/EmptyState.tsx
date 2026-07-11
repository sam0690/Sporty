"use client";

import { Users } from "lucide-react";

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 py-14 text-center ">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
        <Users className="h-5 w-5" />
      </div>
      <h2 className="text-lg text-fg-1">
        No players available
      </h2>
      <p className="mt-2 text-sm text-fg-3">
        {hasFilters
          ? "Try adjusting your filters"
          : "Players will appear here when available"}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 text-sm text-fg-1 transition-colors hover:bg-surface-3"
      >
        Clear Filters
      </button>
    </section>
  );
}
