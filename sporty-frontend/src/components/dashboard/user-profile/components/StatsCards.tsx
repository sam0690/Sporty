"use client";

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
      <p className="num font-display text-5xl leading-none tracking-[-0.02em] text-accent">
        {Math.round(totalPoints)}
      </p>
      <p className="section-label mt-1.5">Total Points</p>

      <div className="mt-4 flex items-center gap-6 border-t border-white/6 pt-4">
        <div>
          <p className="num font-display text-2xl leading-none tracking-[-0.02em] text-fg-1">
            {totalLeagues}
          </p>
          <p className="section-label mt-1.5">Leagues</p>
        </div>
        <div>
          <p className="num font-display text-2xl leading-none tracking-[-0.02em] text-fg-1">
            {bestRank ? `#${bestRank}` : "—"}
          </p>
          <p className="section-label mt-1.5">Best Rank</p>
        </div>
      </div>
    </section>
  );
}
