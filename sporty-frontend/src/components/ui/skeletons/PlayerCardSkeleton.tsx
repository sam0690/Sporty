"use client";

export function PlayerCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
      <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
    </div>
  );
}
