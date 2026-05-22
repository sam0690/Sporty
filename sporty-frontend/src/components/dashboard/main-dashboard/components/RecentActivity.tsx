import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import { formatRelativeTime } from "@/utils/dateUtils";

type RecentActivityProps = {
  items: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
};

function iconForActivity(type: ActivityItem["type"]): string {
  switch (type) {
    case "transfer":
      return "↔";
    case "lineup":
      return "📋";
    case "points":
      return "⭐";
    case "rank":
      return "🏆";
    case "league_joined":
      return "👥";
    case "league_created":
      return "🛠";
    default:
      return "•";
  }
}

export function RecentActivity({
  items,
  isLoading,
  isError,
}: RecentActivityProps) {
  const nowMs = useRelativeTime({ refreshIntervalMs: 60_000 });

  return (
    <Card className="border-white/10 bg-surface/80">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-xl font-bold text-foreground">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-white/8"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-red-300">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
            There are no recent activities yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all hover:border-accent-primary/25 hover:bg-white/8"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary/15 text-xs text-accent-primary">
                      {iconForActivity(item.type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-400">{item.detail}</p>
                      {item.leagueName ? (
                        <p className="mt-1 text-xs text-slate-500">
                          League: {item.leagueName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {formatRelativeTime(item.timestamp, nowMs)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
