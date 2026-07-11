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
  transfer: { Icon: ArrowLeftRight, color: "#e8fb25" },
  lineup: { Icon: ClipboardList, color: "#00d4ff" },
  points: { Icon: Star, color: "#00ff88" },
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
    <section className="flex h-full flex-col overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
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
          <div className="my-5 rounded-[3px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.06)] p-4 text-sm text-[#ff3b5c]">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="my-5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-4 text-sm text-[#777783]">
            No recent activities yet.
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
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
                      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                        {item.title}
                      </p>
                      <span className="shrink-0 section-label whitespace-nowrap text-[#666671] transition-colors group-hover:text-[#9a9aa5]">
                        {formatRelativeTime(item.timestamp, nowMs)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[#9a9aa5]">
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
