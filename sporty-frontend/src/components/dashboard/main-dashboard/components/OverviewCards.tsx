import type { OverviewStat } from "@/components/dashboard/main-dashboard/types";

type OverviewCardsProps = {
  stats: OverviewStat[];
  isLoading?: boolean;
};

export function OverviewCards({
  stats,
  isLoading = false,
}: OverviewCardsProps) {
  return (
    <section aria-label="Overview Stats" className="mb-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5"
          >
            <p className="section-label">{stat.label}</p>
            <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#e8fb25]">
              {isLoading ? "—" : stat.value}
            </p>
            <p className="mt-1 font-barlow-condensed text-xs font-600 uppercase tracking-[1px] text-[#555560]">
              {stat.change}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
