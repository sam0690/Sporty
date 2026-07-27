"use client";

type YourScoreCardProps = {
  yourScore: number;
  weeklyRank: number;
  pointsBehind: number;
  preSeason?: boolean;
};

export function YourScoreCard({
  yourScore,
  weeklyRank,
  pointsBehind,
  preSeason = false,
}: YourScoreCardProps) {
  // Before kickoff there are no points or ranks to show — a literal "0 / #1"
  // reads as real standings. Show a neutral placeholder instead.
  if (preSeason) {
    return (
      <section className="card-surface p-5 text-center animate-fade-soft">
        <p className="section-label">Your Score</p>
        <p className="mt-2 font-display text-6xl tracking-[-0.02em] text-fg-3">
          —
        </p>
        <p className="mt-3 text-sm text-fg-3">
          Scoring starts when the season kicks off.
        </p>
      </section>
    );
  }

  return (
    <section className="card-surface p-5 text-center animate-fade-soft">
      <p className="section-label">Your Score</p>
      <p className="mt-2 font-display text-6xl tracking-[-0.02em] text-accent">
        {yourScore}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div>
          <p className="font-display text-2xl tracking-[-0.02em] text-fg-1">
            #{weeklyRank}
          </p>
          <p className="section-label">This Week</p>
        </div>
        <div className="h-8 w-px bg-white/8" />
        <div>
          <p className="font-display text-2xl tracking-[-0.02em] text-fg-3">
            {pointsBehind}
          </p>
          <p className="section-label">Behind 1st</p>
        </div>
      </div>
    </section>
  );
}
