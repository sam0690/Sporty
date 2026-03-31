"use client";

export function EmptySearch() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-gray-300" aria-hidden="true">🔍</div>
      <h3 className="font-medium text-gray-600">No results found</h3>
      <p className="text-sm text-gray-400">Try searching for something else</p>
    </section>
  );
}
