"use client";

export function TableSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="h-10 border-b border-white/8 bg-surface-3 animate-pulse" />
      <div className="divide-y divide-white/8">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse bg-surface-1 px-5 flex items-center gap-4">
            <div className="h-4 w-6 rounded-[3px] bg-surface-3" />
            <div className="h-4 w-32 rounded-[3px] bg-surface-3" />
            <div className="ml-auto h-4 w-12 rounded-[3px] bg-surface-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
