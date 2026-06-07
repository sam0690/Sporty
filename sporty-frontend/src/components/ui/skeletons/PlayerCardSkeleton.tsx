"use client";

export function PlayerCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-[3px] bg-[#1d1d26]" />
        <div className="h-4 w-32 rounded-[3px] bg-[#1d1d26]" />
      </div>
      <div className="h-6 w-16 rounded-[3px] bg-[#1d1d26]" />
    </div>
  );
}
