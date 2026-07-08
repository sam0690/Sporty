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
    <section className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218] px-5 py-4">
      <p className="num font-bebas text-5xl leading-none tracking-[1px] text-[#e8fb25]">
        {Math.round(totalPoints)}
      </p>
      <p className="section-label mt-1.5">Total Points</p>

      <div className="mt-4 flex items-center gap-6 border-t border-[rgba(255,255,255,0.06)] pt-4">
        <div>
          <p className="num font-bebas text-2xl leading-none tracking-[1px] text-[#f0f0f0]">
            {totalLeagues}
          </p>
          <p className="section-label mt-1.5">Leagues</p>
        </div>
        <div>
          <p className="num font-bebas text-2xl leading-none tracking-[1px] text-[#f0f0f0]">
            {bestRank ? `#${bestRank}` : "—"}
          </p>
          <p className="section-label mt-1.5">Best Rank</p>
        </div>
      </div>
    </section>
  );
}
