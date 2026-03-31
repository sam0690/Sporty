"use client";

type EmptyTransfersProps = {
  onClearFilters: () => void;
};

export function EmptyTransfers({ onClearFilters }: EmptyTransfersProps) {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-gray-300" aria-hidden="true">🔍</div>
      <h3 className="font-medium text-gray-600">No players found</h3>
      <p className="text-sm text-gray-400">Try adjusting your filters</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-4 rounded-full border border-gray-300 px-6 py-2 text-gray-600 hover:bg-gray-50"
      >
        Clear Filters
      </button>
    </section>
  );
}
