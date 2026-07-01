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
  const stats: Array<{ label: string; value: string; accent: string }> = [
    { label: "Total Points", value: String(Math.round(totalPoints)), accent: "#DC2626" },
    { label: "Leagues", value: String(totalLeagues), accent: "#0B1220" },
    {
      label: "Best Rank",
      value: bestRank ? `#${bestRank}` : "—",
      accent: "#DC2626",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-4"
        >
          <p
            className="font-bebas text-3xl leading-none tracking-[2px]"
            style={{ color: stat.accent }}
          >
            {stat.value}
          </p>
          <p className="section-label mt-1.5">{stat.label}</p>
        </article>
      ))}
    </section>
  );
}
