"use client";

export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="shimmer h-10 border-b border-border" />
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex h-12 items-center gap-4 bg-surface px-5"
          >
            <div className="shimmer h-4 w-6 rounded-sm" />
            <div className="shimmer h-4 w-32 rounded-sm" />
            <div className="shimmer ml-auto h-4 w-12 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
