"use client";

type StatsCardsProps = {
  totalPoints: number;
  totalLeagues: number;
  bestRank: number;
};

export function StatsCards({ totalPoints, totalLeagues, bestRank }: StatsCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
      <article className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Total Points</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{totalPoints}</p>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Leagues</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{totalLeagues}</p>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Best Rank</p>
        <p className="mt-1 text-2xl font-semibold text-primary-700">#{bestRank}</p>
      </article>
    </section>
  );
}
