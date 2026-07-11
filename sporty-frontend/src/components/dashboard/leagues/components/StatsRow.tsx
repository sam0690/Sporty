"use client";

type StatsRowProps = {
  totalLeagues: number;
  highestRank: number;
  totalPoints: number;
};

export function StatsRow({
  totalLeagues,
  highestRank,
  totalPoints,
}: StatsRowProps) {
  return (
    <section className="flex flex-wrap items-center gap-0 card-surface divide-x divide-white/8">
      {[
        { label: "Leagues", value: totalLeagues },
        { label: "Best Rank", value: highestRank ? `#${highestRank}` : "—" },
        { label: "Total Pts", value: totalPoints },
      ].map(({ label, value }) => (
        <div key={label} className="flex-1 px-5 py-4 text-center">
          <p className="font-display text-3xl tracking-[-0.02em] text-accent">
            {value}
          </p>
          <p className="section-label mt-1">{label}</p>
        </div>
      ))}
    </section>
  );
}
