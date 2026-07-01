"use client";

export function LeagueCardSkeleton() {
  return (
    <div className="h-64 w-full overflow-hidden rounded-md border border-border bg-surface">
      <div className="shimmer h-28 w-full" />
      <div className="space-y-3 p-5">
        <div className="shimmer h-4 w-3/4 rounded-sm" />
        <div className="shimmer h-3 w-1/2 rounded-sm" />
        <div className="shimmer h-3 w-1/3 rounded-sm" />
      </div>
    </div>
  );
}
