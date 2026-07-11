"use client";

export function LeagueCardSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse card-surface">
      <div className="h-28 bg-surface-3" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-3/4 rounded-[3px] bg-surface-3" />
        <div className="h-3 w-1/2 rounded-[3px] bg-surface-3" />
        <div className="h-3 w-1/3 rounded-[3px] bg-surface-3" />
      </div>
    </div>
  );
}
