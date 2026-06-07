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
    case "transfer":      return "↔";
    case "lineup":        return "▤";
    case "points":        return "★";
    case "rank":          return "▲";
    case "league_joined": return "◈";
    case "league_created": return "◉";
    default:              return "·";
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
              <div
                key={index}
                className="h-16 animate-pulse rounded-[3px] bg-[#1d1d26]"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[#2a1010] p-4 text-sm text-[#ff3b30]">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
            No recent activities yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 transition-colors hover:border-[rgba(232,251,37,0.15)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[3px] bg-[#111117] font-bebas text-sm text-[#e8fb25]">
                      {iconForActivity(item.type)}
                    </span>
                    <div>
                      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                        {item.title}
                      </p>
                      <p className="text-sm text-[#555560]">{item.detail}</p>
                      {item.leagueName ? (
                        <p className="mt-0.5 section-label">{item.leagueName}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 section-label whitespace-nowrap">
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
