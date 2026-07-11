"use client";

import { StatTile } from "@/components/ui";

type StatsCardsProps = {
  totalPoints: number;
  totalLeagues: number;
  bestRank: number | null;
};

export function StatsCards({
  totalPoints,
  totalLeagues,
  bestRank,
}: StatsCardsProps) {
  return (
    <section className="card-surface px-5 py-4">
      <StatTile label="Total Points" value={Math.round(totalPoints)} size="hero" />

      <div className="mt-4 flex items-center gap-6 border-t border-white/6 pt-4">
        <StatTile label="Leagues" value={totalLeagues} size="sm" tone="neutral" />
        <StatTile
          label="Best Rank"
          value={bestRank ? `#${bestRank}` : "—"}
          size="sm"
          tone="neutral"
        />
      </div>
    </section>
  );
}
