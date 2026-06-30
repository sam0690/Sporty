"use client";

import { useMatchStore } from "@/store/matchStore";

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="flex items-center gap-2">
        <span className="live-badge">Live Score</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="truncate text-right text-base font-600 text-slate-200">
          {homeTeam ?? "Home"}
        </span>
        <span className="whitespace-nowrap font-bebas text-5xl tracking-[3px] text-[#e8fb25]">
          {score.home} <span className="text-slate-500">-</span> {score.away}
        </span>
        <span className="truncate text-left text-base font-600 text-slate-200">
          {awayTeam ?? "Away"}
        </span>
      </div>
      <div className="mt-1 text-center">
        <span className="section-label">{status}</span>
      </div>
    </div>
  );
}
