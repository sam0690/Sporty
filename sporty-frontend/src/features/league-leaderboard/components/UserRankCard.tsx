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
    <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-accent/20 bg-accent/4 p-5 animate-fade-soft">
      <div>
        <p className="section-label">Your Position</p>
        <p className="mt-1 font-display text-6xl tracking-[-0.02em] text-accent">
          #{rank}
        </p>
        <p className="mt-1 font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
          {teamName}
        </p>
      </div>

      <div className="text-right">
        <p className="font-display text-5xl tracking-[-0.02em] text-accent">
          {totalPoints}
        </p>
        <p className="section-label">Total Points</p>
        {rank > 1 ? (
          <p className="mt-1 font-sans text-xs font-600 uppercase tracking-[1px] text-fg-3">
            {pointsBehind} pts behind leader
          </p>
        ) : null}
      </div>
    </section>
  );
}
