"use client";

type StatsCardsProps = {
  totalPoints: number;
  totalLeagues: number;
  bestRank: number;
};

export function StatsCards({
  totalPoints,
  totalLeagues,
  bestRank,
}: StatsCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-wide text-foreground/55">
          Total Points
        </p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {totalPoints}
        </p>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-wide text-foreground/55">
          Leagues
        </p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {totalLeagues}
        </p>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-wide text-foreground/55">
          Best Rank
        </p>
        <p className="mt-1 text-2xl font-semibold text-primary">#{bestRank}</p>
      </article>
    </section>
  );
}
