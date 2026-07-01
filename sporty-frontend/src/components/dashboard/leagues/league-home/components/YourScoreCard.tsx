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
    <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5 text-center animate-fade-soft">
      <p className="section-label">Your Score</p>
      <p className="mt-2 font-bebas text-6xl tracking-[3px] text-[#DC2626]">
        {yourScore}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-[#0B1220]">
            #{weeklyRank}
          </p>
          <p className="section-label">This Week</p>
        </div>
        <div className="h-8 w-px bg-[rgba(11,18,32,0.08)]" />
        <div>
          <p className="font-bebas text-2xl tracking-[2px] text-[#6B7280]">
            {pointsBehind}
          </p>
          <p className="section-label">Behind 1st</p>
        </div>
      </div>
    </section>
  );
}
