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
    <section className="rounded-lg border border-primary/20 bg-primary/10 p-5 text-center [animation:fade-soft_0.2s_ease]">
      <h2 className="mb-2 text-sm font-medium text-primary">Your Score</h2>
      <p className="text-4xl font-bold text-primary-900">{yourScore}</p>
      <p className="mt-2 text-sm text-primary">Rank #{weeklyRank} this week</p>
      <p className="mt-1 text-xs text-primary-500">{pointsBehind} points behind 1st</p>
    </section>
  );
}
