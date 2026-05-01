"use client";

type StatsCardsProps = {
  totalPoints: number;
  totalLeagues: number;
  bestRank: number;
};

export function StatsCards({ totalPoints, totalLeagues, bestRank }: StatsCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
      <article className="rounded-lg border border-accent/20 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-secondary">Total Points</p>
        <p className="mt-1 text-2xl font-semibold text-black">{totalPoints}</p>
      </article>

      <article className="rounded-lg border border-accent/20 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-secondary">Leagues</p>
        <p className="mt-1 text-2xl font-semibold text-black">{totalLeagues}</p>
      </article>

      <article className="rounded-lg border border-accent/20 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-secondary">Best Rank</p>
        <p className="mt-1 text-2xl font-semibold text-primary">#{bestRank}</p>
      </article>
    </section>
  );
}
