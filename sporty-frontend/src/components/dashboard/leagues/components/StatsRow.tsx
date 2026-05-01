"use client";

type StatsRowProps = {
  totalLeagues: number;
  highestRank: number;
  totalPoints: number;
};

export function StatsRow({ totalLeagues, highestRank, totalPoints }: StatsRowProps) {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-full border border-accent/20 bg-[#F4F4F9] px-4 py-2 text-xs font-bold text-secondary">
      <span>{totalLeagues} leagues</span>
      <span>•</span>
      <span>Best rank #{highestRank}</span>
      <span>•</span>
      <span>{totalPoints} points</span>
    </section>
  );
}
