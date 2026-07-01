"use client";

export function LeaderboardSkeleton() {
  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-12 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
      <div className="h-10 w-48 animate-pulse rounded-[3px] bg-[#F3F4F7]" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
        <div className="h-24 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
        <div className="h-24 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
      </div>

      <div className="h-20 animate-pulse rounded-[3px] bg-[#F3F4F7]" />

      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-[3px] bg-[#F3F4F7]"
          />
        ))}
      </div>
    </section>
  );
}
