"use client";

import { useMatchStore } from "@/store/matchStore";

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);

  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="flex items-center gap-2">
        <span className="live-badge">Live Score</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-bebas text-5xl tracking-[3px] text-[#e8fb25]">{score.home}</span>
        <span className="section-label">{status}</span>
        <span className="font-bebas text-5xl tracking-[3px] text-[#e8fb25]">{score.away}</span>
      </div>
    </div>
  );
}
