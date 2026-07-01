"use client";

export function PlayerCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="shimmer h-9 w-9 rounded-sm" />
        <div className="shimmer h-4 w-32 rounded-sm" />
      </div>
      <div className="shimmer h-6 w-16 rounded-sm" />
    </div>
  );
}
