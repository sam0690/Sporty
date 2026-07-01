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
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="block accent-bar accent-primary p-5"
          >
            <p className="micro-label">{stat.label}</p>
            <p className="stat-num num mt-2 text-5xl text-ink">
              {isLoading ? "—" : stat.value}
            </p>
            <p className="mt-1.5 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {stat.change}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
