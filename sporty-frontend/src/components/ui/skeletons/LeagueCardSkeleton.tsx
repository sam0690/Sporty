"use client";

export function LeagueCardSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="h-28 bg-[#1d1d26]" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-3/4 rounded-[3px] bg-[#1d1d26]" />
        <div className="h-3 w-1/2 rounded-[3px] bg-[#1d1d26]" />
        <div className="h-3 w-1/3 rounded-[3px] bg-[#1d1d26]" />
      </div>
    </div>
  );
}
