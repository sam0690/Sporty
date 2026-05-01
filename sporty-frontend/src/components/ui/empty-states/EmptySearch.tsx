"use client";

export function EmptySearch() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-secondary/40" aria-hidden="true">🔍</div>
      <h3 className="font-medium text-secondary">No results found</h3>
      <p className="text-sm text-secondary/60">Try searching for something else</p>
    </section>
  );
}
