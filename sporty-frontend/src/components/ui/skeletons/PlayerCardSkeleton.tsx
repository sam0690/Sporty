"use client";

export function PlayerCardSkeleton() {
  return (
    <div className="flex items-center justify-between card-surface p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-[3px] bg-surface-3" />
        <div className="h-4 w-32 rounded-[3px] bg-surface-3" />
      </div>
      <div className="h-6 w-16 rounded-[3px] bg-surface-3" />
    </div>
  );
}
