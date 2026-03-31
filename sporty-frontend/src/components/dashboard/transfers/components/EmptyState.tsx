"use client";

type EmptyStateProps = {
  hasFilters: boolean;
};

export function EmptyState({ hasFilters }: EmptyStateProps) {
  return (
    <section className="py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-10 w-10 text-text-secondary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-text-primary">No players found</h2>
      <p className="mt-2 text-text-secondary">
        {hasFilters
          ? "Try adjusting your filters"
          : "Players will appear here when available"}
      </p>
    </section>
  );
}
