export default function FixturesLoading() {
  // Mirrors the real page shape: hero card, filter chip row, panel grid.
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="skeleton h-64 rounded-[3px] border border-white/6" />
      <div className="mt-8 flex gap-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-28 rounded-[3px]" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="skeleton h-56 rounded-[3px] border border-white/6"
          />
        ))}
      </div>
    </div>
  );
}
