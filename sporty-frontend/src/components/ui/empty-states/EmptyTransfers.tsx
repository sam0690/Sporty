"use client";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-secondary/40" aria-hidden="true">🔍</div>
      <h3 className="font-medium text-secondary">No players found</h3>
      <p className="text-sm text-secondary/60">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-4 rounded-full border border-border px-6 py-2 text-secondary hover:bg-[#F4F4F9]"
      >
        Clear Filters
      </button>
    </section>
  );
}
