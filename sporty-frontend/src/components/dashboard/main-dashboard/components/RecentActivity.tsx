import {
  ArrowLeftRight,
  ClipboardList,
  Star,
  TrendingUp,
  UserPlus,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import { formatRelativeTime } from "@/utils/dateUtils";

type RecentActivityProps = {
  items: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
};

const ACTIVITY_META: Record<
  ActivityItem["type"],
  { Icon: LucideIcon; color: string }
> = {
  transfer: { Icon: ArrowLeftRight, color: "#e2c368" },
  lineup: { Icon: ClipboardList, color: "#00d4ff" },
  points: { Icon: Star, color: "#00e07f" },
  rank: { Icon: TrendingUp, color: "#ff6b00" },
  league_joined: { Icon: UserPlus, color: "#9b59b6" },
  league_created: { Icon: Trophy, color: "#ffd86b" },
};

export function RecentActivity({
  items,
  isLoading,
  isError,
}: RecentActivityProps) {
  const nowMs = useRelativeTime({ refreshIntervalMs: 60_000 });

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
      <header className="border-b border-white/7 px-5 py-4">
        <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#d7d7de]">
          Recent Activity
        </h2>
      </header>

      <div className="flex-1 px-5">
        {isLoading ? (
          <div className="space-y-3 py-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-11 rounded-[3px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="my-5 rounded-[3px] border border-danger/25 bg-danger/6 p-4 text-sm text-danger">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="my-5 rounded-[3px] border border-white/8 bg-surface-2 p-4 text-sm text-fg-2">
            No recent activities yet.
          </div>
        ) : (
          <ul className="divide-y divide-white/6">
            {items.map((item) => {
              const meta = ACTIVITY_META[item.type];
              const Icon = meta.Icon;
              return (
                <li key={item.id} className="group flex items-start gap-3 py-3.5">
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: meta.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-fg-1">
                        {item.title}
                      </p>
                      <span className="shrink-0 section-label whitespace-nowrap text-fg-3 transition-colors group-hover:text-fg-2">
                        {formatRelativeTime(item.timestamp, nowMs)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-fg-2">
                      {item.detail}
                    </p>
                    {item.leagueName ? (
                      <p className="mt-1 section-label">{item.leagueName}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
