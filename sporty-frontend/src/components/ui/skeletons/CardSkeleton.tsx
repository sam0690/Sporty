"use client";

export function CardSkeleton() {
  return (
    <div className="h-48 w-full animate-pulse rounded-[3px] border border-white/8 bg-surface-1">
      <div className="p-5 space-y-3">
        <div className="h-3 w-1/3 rounded-[3px] bg-surface-3" />
        <div className="h-8 w-1/2 rounded-[3px] bg-surface-3" />
        <div className="h-3 w-1/4 rounded-[3px] bg-surface-3" />
      </div>
    </div>
  );
}
