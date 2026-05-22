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
            className="border-white/10 bg-surface/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/30 hover:shadow-[0_18px_50px_rgba(0,229,255,0.10)]"
          >
            <CardContent className="p-5">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
                {isLoading ? "..." : stat.value}
              </p>
              <p className="mt-2 text-xs font-semibold text-accent-primary">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
