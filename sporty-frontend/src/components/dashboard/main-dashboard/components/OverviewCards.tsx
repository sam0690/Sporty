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
            className="rounded-2xl border border-gray-100 bg-white shadow-none transition-all duration-200 hover:shadow-md"
          >
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900">
                {isLoading ? "..." : stat.value}
              </p>
              <p className="mt-2 text-xs font-medium text-primary-600">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
