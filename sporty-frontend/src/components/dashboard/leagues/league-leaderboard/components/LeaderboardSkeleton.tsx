"use client";

export function LeaderboardSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="h-12 rounded-lg bg-gray-200 animate-pulse" />
      <div className="h-10 w-48 rounded-lg bg-gray-200 animate-pulse" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
      </div>

      <div className="h-20 rounded-lg bg-gray-200 animate-pulse" />

      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-12 rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    </section>
  );
}
