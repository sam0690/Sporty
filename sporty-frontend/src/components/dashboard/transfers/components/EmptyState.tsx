"use client";

import { Users } from "lucide-react";

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 py-14 text-center backdrop-blur-xl">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-slate-400">
        <Users className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-medium text-foreground">
        No players available
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        {hasFilters
          ? "Try adjusting your filters"
          : "Players will appear here when available"}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8"
      >
        Clear Filters
      </button>
    </section>
  );
}
