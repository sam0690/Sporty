"use client";

import { StatTile } from "@/components/ui";

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
    <section className="flex flex-wrap items-center gap-0 card-surface divide-x divide-white/8">
      {[
        { label: "Leagues", value: totalLeagues },
        { label: "Best Rank", value: highestRank ? `#${highestRank}` : "—" },
        { label: "Total Pts", value: totalPoints },
      ].map(({ label, value }) => (
        <StatTile
          key={label}
          label={label}
          value={value}
          className="flex-1 px-5 py-4 text-center"
        />
      ))}
    </section>
  );
}
