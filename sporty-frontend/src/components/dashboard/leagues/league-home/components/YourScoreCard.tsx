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
    <section className="rounded-2xl border border-primary-100 bg-primary-50 p-5 text-center [animation:fade-soft_0.2s_ease]">
      <h2 className="mb-2 text-sm font-medium text-primary-700">Your Score</h2>
      <p className="text-4xl font-light text-primary-900">{yourScore}</p>
      <p className="mt-2 text-sm text-primary-600">Rank #{weeklyRank} this week</p>
      <p className="mt-1 text-xs text-primary-500">{pointsBehind} points behind 1st</p>
    </section>
  );
}
