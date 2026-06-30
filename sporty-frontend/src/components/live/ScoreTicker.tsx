"use client";

import { useMatchStore } from "@/store/matchStore";

function describeStatus(status: string): { label: string; live: boolean } {
  const s = status.toLowerCase();
  if (s === "live" || s === "in_progress" || s === "playing") {
    return { label: "Live", live: true };
  }
  if (s === "finished" || s === "ft" || s === "completed") {
    return { label: "Full Time", live: false };
  }
  if (s === "scheduled" || s === "upcoming") {
    return { label: "Kick Off Soon", live: false };
  }
  return { label: status.replace(/_/g, " "), live: false };
}

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  const { label, live } = describeStatus(status);

  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        {live ? (
          <span className="inline-flex items-center gap-1.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#ff3b5c]">
            <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
            Live
          </span>
        ) : (
          <span className="section-label">{label}</span>
        )}
        <span className="section-label">Match Centre</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-7">
        <div className="min-w-0 text-right">
          <p className="truncate font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-xl">
            {homeTeam ?? "Home"}
          </p>
          <p className="section-label mt-1.5">Home</p>
        </div>

        <div className="shrink-0 font-bebas text-5xl leading-none tracking-[3px] text-[#e8fb25] sm:text-6xl">
          {score.home}
          <span className="px-2 text-[#555560]">-</span>
          {score.away}
        </div>

        <div className="min-w-0 text-left">
          <p className="truncate font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-xl">
            {awayTeam ?? "Away"}
          </p>
          <p className="section-label mt-1.5">Away</p>
        </div>
      </div>
    </section>
  );
}
