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
    <section className="pop-in flex h-full flex-col overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-26px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden
        className="h-[2px] w-full"
        style={{ background: "linear-gradient(90deg, #00d4ff, transparent 80%)" }}
      />
      <header className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#d7d7de]">
          Recent Activity
        </h2>
      </header>

      <div className="flex-1 p-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-16 rounded-[10px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-[10px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.06)] p-4 text-sm text-[#ff3b5c]">
            Failed to load recent activity.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a22] p-4 text-sm text-[#777783]">
            No recent activities yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const meta = ACTIVITY_META[item.type];
              const Icon = meta.Icon;
              return (
                <li
                  key={item.id}
                  className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a22] px-4 py-3 transition-colors hover:border-[rgba(232,251,37,0.2)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[7px]"
                        style={{ color: meta.color, background: `${meta.color}1a` }}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                          {item.title}
                        </p>
                        <p className="text-sm text-[#9a9aa5]">{item.detail}</p>
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
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
