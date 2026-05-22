"use client";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-foreground/30" aria-hidden="true">
        🔍
      </div>
      <h3 className="font-medium text-foreground">No players found</h3>
      <p className="text-sm text-foreground/60">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-4 rounded-full border border-white/10 px-6 py-2 text-foreground transition-colors hover:bg-white/10"
      >
        Clear Filters
      </button>
    </section>
  );
}
