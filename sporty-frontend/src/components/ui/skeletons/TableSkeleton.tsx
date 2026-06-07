"use client";

export function TableSkeleton() {
  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] overflow-hidden">
      <div className="h-10 border-b border-[rgba(255,255,255,0.08)] bg-[#1d1d26] animate-pulse" />
      <div className="divide-y divide-[rgba(255,255,255,0.08)]">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse bg-[#111117] px-5 flex items-center gap-4">
            <div className="h-4 w-6 rounded-[3px] bg-[#1d1d26]" />
            <div className="h-4 w-32 rounded-[3px] bg-[#1d1d26]" />
            <div className="ml-auto h-4 w-12 rounded-[3px] bg-[#1d1d26]" />
          </div>
        ))}
      </div>
    </div>
  );
}
