import { Card, CardContent } from "@/components/ui";
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
    <section aria-label="Overview Stats" className="mb-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="rounded-lg border border-accent/20 bg-white shadow-card transition-all duration-200 hover:shadow-hover"
          >
            <CardContent className="p-5">
              <p className="text-sm text-secondary">{stat.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-black">
                {isLoading ? "..." : stat.value}
              </p>
              <p className="mt-2 text-xs font-semibold text-primary">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
