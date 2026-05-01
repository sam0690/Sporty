"use client";

export function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-accent/20" />
      ))}
    </div>
  );
}
