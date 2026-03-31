import { Card, CardContent } from "@/components/ui";
import type { OverviewStat } from "@/components/dashboard/main-dashboard/types";

type OverviewCardsProps = {
  stats: OverviewStat[];
};

export function OverviewCards({ stats }: OverviewCardsProps) {
  return (
    <section aria-label="Overview Stats" className="mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border-light bg-surface-100 transition-shadow hover:shadow-card-hover">
            <CardContent className="p-5">
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-primary-700">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
