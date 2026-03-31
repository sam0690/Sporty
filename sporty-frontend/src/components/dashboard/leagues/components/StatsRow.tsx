"use client";

type StatsRowProps = {
  totalLeagues: number;
  highestRank: number;
  totalPoints: number;
};

export function StatsRow({ totalLeagues, highestRank, totalPoints }: StatsRowProps) {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-xs font-light text-gray-600">
      <span>{totalLeagues} leagues</span>
      <span>•</span>
      <span>Best rank #{highestRank}</span>
      <span>•</span>
      <span>{totalPoints} points</span>
    </section>
  );
}
