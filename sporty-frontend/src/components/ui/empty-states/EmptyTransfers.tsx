"use client";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-[#f0f0f0]/30" aria-hidden="true">
        🔍
      </div>
      <h3 className="font-medium text-[#f0f0f0]">No players found</h3>
      <p className="text-sm text-[#555560]">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] px-6 py-2 text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
      >
        Clear Filters
      </button>
    </section>
  );
}
