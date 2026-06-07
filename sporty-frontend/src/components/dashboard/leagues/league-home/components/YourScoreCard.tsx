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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 text-center animate-fade-soft">
      <p className="section-label">Your Score</p>
      <p className="mt-2 font-bebas text-6xl tracking-[3px] text-[#e8fb25]">
        {yourScore}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-[#f0f0f0]">
            #{weeklyRank}
          </p>
          <p className="section-label">This Week</p>
        </div>
        <div className="h-8 w-px bg-[rgba(255,255,255,0.08)]" />
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-[#555560]">
            {pointsBehind}
          </p>
          <p className="section-label">Behind 1st</p>
        </div>
      </div>
    </section>
  );
}
