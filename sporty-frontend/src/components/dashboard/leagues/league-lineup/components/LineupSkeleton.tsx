"use client";

export function LineupSkeleton() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-10 w-full animate-pulse rounded-[3px] bg-[#1d1d26]" />
      <div className="h-24 w-full animate-pulse rounded-[3px] bg-[#1d1d26]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-20 animate-pulse rounded-[3px] bg-[#1d1d26]" />
          <div className="h-20 animate-pulse rounded-[3px] bg-[#1d1d26]" />
        </div>
        <div className="space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-20 animate-pulse rounded-[3px] bg-[#1d1d26]" />
        </div>
      </div>
      <div className="h-10 w-32 animate-pulse rounded-[3px] bg-[#1d1d26]" />
    </section>
  );
}
