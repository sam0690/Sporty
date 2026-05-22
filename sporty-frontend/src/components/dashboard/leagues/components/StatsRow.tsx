"use client";

type StatsRowProps = {
  totalLeagues: number;
  highestRank: number;
  totalPoints: number;
};

export function StatsRow({
  totalLeagues,
  highestRank,
  totalPoints,
}: StatsRowProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-md">
      <span className="rounded-full bg-white/6 px-3 py-1">
        {totalLeagues} leagues
      </span>
      <span className="text-white/20">•</span>
      <span className="rounded-full bg-white/6 px-3 py-1">
        Best rank #{highestRank || "-"}
      </span>
      <span className="text-white/20">•</span>
      <span className="rounded-full bg-white/6 px-3 py-1">
        {totalPoints} points
      </span>
    </section>
  );
}
