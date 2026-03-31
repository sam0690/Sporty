"use client";

import { Users } from "lucide-react";

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white py-14 text-center">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 text-gray-400">
        <Users className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-medium text-gray-600">No players available</h2>
      <p className="mt-2 text-sm text-gray-400">
        {hasFilters
          ? "Try adjusting your filters"
          : "Players will appear here when available"}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        Clear Filters
      </button>
    </section>
  );
}
