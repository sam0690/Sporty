"use client";

type YourScoreCardProps = {
  yourScore: number;
  weeklyRank: number;
  pointsBehind: number;
};

export function YourScoreCard({
  yourScore,
  weeklyRank,
  pointsBehind,
}: YourScoreCardProps) {
  return (
    <section className="rounded-lg bg-primary-50 p-6 text-center shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">Your Score</h2>
      <p className="mt-2 text-4xl font-bold text-primary-600">{yourScore}</p>
      <p className="mt-2 text-sm text-text-secondary">Rank #{weeklyRank} this week</p>
      <p className="mt-1 text-sm text-text-secondary">{pointsBehind} points behind 1st</p>
    </section>
  );
}
