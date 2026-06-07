"use client";

type StatsCardsProps = {
  totalPoints: number;
  totalLeagues: number;
  bestRank: number;
};

export function StatsCards({
  totalPoints,
  totalLeagues,
  bestRank,
}: StatsCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
        <p className="text-xs uppercase tracking-wide text-[#555560]">
          Total Points
        </p>
        <p className="mt-1 text-2xl font-600 text-[#f0f0f0]">
          {totalPoints}
        </p>
      </article>

      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
        <p className="text-xs uppercase tracking-wide text-[#555560]">
          Leagues
        </p>
        <p className="mt-1 text-2xl font-600 text-[#f0f0f0]">
          {totalLeagues}
        </p>
      </article>

      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
        <p className="text-xs uppercase tracking-wide text-[#555560]">
          Best Rank
        </p>
        <p className="mt-1 text-2xl font-600 text-primary">#{bestRank}</p>
      </article>
    </section>
  );
}
