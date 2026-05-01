"use client";

import { Users } from "lucide-react";

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-accent/20 bg-white py-14 text-center">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border text-secondary/60">
        <Users className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-medium text-secondary">No players available</h2>
      <p className="mt-2 text-sm text-secondary/60">
        {hasFilters
          ? "Try adjusting your filters"
          : "Players will appear here when available"}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 rounded-full border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-border hover:bg-[#F4F4F9]"
      >
        Clear Filters
      </button>
    </section>
  );
}
