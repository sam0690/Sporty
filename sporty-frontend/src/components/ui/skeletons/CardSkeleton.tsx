"use client";

export function CardSkeleton() {
  return (
    <div className="h-48 w-full rounded-md border border-border bg-surface">
      <div className="space-y-3 p-5">
        <div className="shimmer h-3 w-1/3 rounded-sm" />
        <div className="shimmer h-8 w-1/2 rounded-sm" />
        <div className="shimmer h-3 w-1/4 rounded-sm" />
      </div>
    </div>
  );
}
