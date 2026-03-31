"use client";

type StatsRowProps = {
  totalLeagues: number;
  highestRank: number;
  totalPoints: number;
};

export function StatsRow({ totalLeagues, highestRank, totalPoints }: StatsRowProps) {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-2xl font-bold text-primary-600">{totalLeagues}</p>
        <p className="text-sm text-text-secondary">Total Leagues</p>
      </div>

      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-2xl font-bold text-primary-600">#{highestRank}</p>
        <p className="text-sm text-text-secondary">Highest Rank</p>
      </div>

      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-2xl font-bold text-primary-600">{totalPoints}</p>
        <p className="text-sm text-text-secondary">Total Points</p>
      </div>
    </section>
  );
}
