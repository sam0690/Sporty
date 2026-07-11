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
    <section className="card-surface p-5 text-center animate-fade-soft">
      <p className="section-label">Your Score</p>
      <p className="mt-2 font-bebas text-6xl tracking-[3px] text-accent">
        {yourScore}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-fg-1">
            #{weeklyRank}
          </p>
          <p className="section-label">This Week</p>
        </div>
        <div className="h-8 w-px bg-white/8" />
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-fg-3">
            {pointsBehind}
          </p>
          <p className="section-label">Behind 1st</p>
        </div>
      </div>
    </section>
  );
}
