export default function FixturesLoading() {
  // Mirrors the real page shape: sticky toolbar, then stacked competition sections.
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
      <div className="pb-3 pt-4">
        <div className="skeleton h-8 w-40 rounded-[3px]" />
        <div className="skeleton mt-3 h-12 rounded-[3px]" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="skeleton h-36 rounded-[3px] border border-white/6"
          />
        ))}
      </div>
    </div>
  );
}
