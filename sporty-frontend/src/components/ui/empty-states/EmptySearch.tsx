"use client";

export function EmptySearch() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-[#f0f0f0]/30" aria-hidden="true">
        🔍
      </div>
      <h3 className="font-medium text-[#f0f0f0]">No results found</h3>
      <p className="text-sm text-[#555560]">
        Try searching for something else
      </p>
    </section>
  );
}
