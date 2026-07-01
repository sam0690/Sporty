"use client";

type UserRankCardProps = {
  rank: number;
  teamName: string;
  totalPoints: number;
  pointsBehind: number;
};

export function UserRankCard({
  rank,
  teamName,
  totalPoints,
  pointsBehind,
}: UserRankCardProps) {
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.04)] p-5 animate-fade-soft">
      <div>
        <p className="section-label">Your Position</p>
        <p className="mt-1 font-bebas text-6xl tracking-[3px] text-[#DC2626]">
          #{rank}
        </p>
        <p className="mt-1 font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
          {teamName}
        </p>
      </div>

      <div className="text-right">
        <p className="font-bebas text-5xl tracking-[2px] text-[#DC2626]">
          {totalPoints}
        </p>
        <p className="section-label">Total Points</p>
        {rank > 1 ? (
          <p className="mt-1 font-barlow-condensed text-xs font-semibold uppercase tracking-[1px] text-[#6B7280]">
            {pointsBehind} pts behind leader
          </p>
        ) : null}
      </div>
    </section>
  );
}
