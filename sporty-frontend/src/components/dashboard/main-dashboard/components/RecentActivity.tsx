import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  LayoutGrid,
  Star,
  TrendingUp,
  LogIn,
  PlusCircle,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import { formatRelativeTime } from "@/utils/dateUtils";

type RecentActivityProps = {
  items: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
};

function iconForActivity(
  type: ActivityItem["type"],
): ComponentType<{ className?: string }> {
  switch (type) {
    case "transfer":       return ArrowLeftRight;
    case "lineup":         return LayoutGrid;
    case "points":         return Star;
    case "rank":           return TrendingUp;
    case "league_joined":  return LogIn;
    case "league_created": return PlusCircle;
    default:               return Activity;
  }
}

export function RecentActivity({
  items,
  isLoading,
  isError,
}: RecentActivityProps) {
  const nowMs = useRelativeTime({ refreshIntervalMs: 60_000 });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="shimmer h-16 rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-danger/20 bg-danger-soft p-4 text-sm font-medium text-danger">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-border bg-surface-muted p-4 text-sm text-ink-muted">
            No recent activities yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = iconForActivity(item.type);
              return (
                <li
                  key={item.id}
                  className="rounded-md border border-border bg-surface-muted px-4 py-3 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-sm bg-surface text-primary shadow-xs">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-condensed text-sm font-bold uppercase tracking-[0.04em] text-ink">
                          {item.title}
                        </p>
                        <p className="text-sm text-ink-muted">{item.detail}</p>
                        {item.leagueName ? (
                          <p className="section-label mt-0.5">{item.leagueName}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="section-label shrink-0 whitespace-nowrap">
                      {formatRelativeTime(item.timestamp, nowMs)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
