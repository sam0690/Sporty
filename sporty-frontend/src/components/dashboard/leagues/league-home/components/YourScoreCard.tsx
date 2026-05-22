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
    <section className="rounded-[1.75rem] border border-accent-primary/20 bg-linear-to-br from-accent-primary/10 to-accent-secondary/10 p-5 text-center shadow-[0_18px_50px_rgba(0,229,255,0.1)] backdrop-blur-xl [animation:fade-soft_0.2s_ease]">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent-primary">
        Your Score
      </h2>
      <p className="text-4xl font-bold text-foreground">{yourScore}</p>
      <p className="mt-2 text-sm text-slate-300">
        Rank #{weeklyRank} this week
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {pointsBehind} points behind 1st
      </p>
    </section>
  );
}
