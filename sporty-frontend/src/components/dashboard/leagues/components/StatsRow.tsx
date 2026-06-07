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
    <section className="flex flex-wrap items-center gap-0 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] divide-x divide-[rgba(255,255,255,0.08)]">
      {[
        { label: "Leagues", value: totalLeagues },
        { label: "Best Rank", value: highestRank ? `#${highestRank}` : "—" },
        { label: "Total Pts", value: totalPoints },
      ].map(({ label, value }) => (
        <div key={label} className="flex-1 px-5 py-4 text-center">
          <p className="font-bebas text-3xl tracking-[2px] text-[#e8fb25]">
            {value}
          </p>
          <p className="section-label mt-1">{label}</p>
        </div>
      ))}
    </section>
  );
}
