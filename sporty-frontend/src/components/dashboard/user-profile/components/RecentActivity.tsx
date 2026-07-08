"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ChartNoAxesCombined,
  Trophy,
  Users,
} from "lucide-react";
import type {
  TUserActivityItem,
  TUserActivityType,
} from "@/services/UserService";

type RecentActivityProps = {
  recentActivity: TUserActivityItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

type FilterType = "all" | TUserActivityType;

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "transfer", label: "Transfers" },
  { value: "points", label: "Points" },
  { value: "lineup", label: "Lineups" },
  { value: "rank", label: "Rank" },
];

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ActivityIcon({ type }: { type: TUserActivityType }) {
  if (type === "transfer") {
    return <ArrowRightLeft className="h-4 w-4" />;
  }
  if (type === "points") {
    return <ChartNoAxesCombined className="h-4 w-4" />;
  }
  if (type === "lineup") {
    return <Users className="h-4 w-4" />;
  }
  return <Trophy className="h-4 w-4" />;
}

function ActivityCard({ activity }: { activity: TUserActivityItem }) {
  const points = toNumber(activity.details.points);
  const rank = toNumber(activity.details.rank);
  const windowNumber = toNumber(activity.details.window_number);
  const playerIn =
    typeof activity.details.player_in === "string"
      ? activity.details.player_in
      : null;
  const playerOut =
    typeof activity.details.player_out === "string"
      ? activity.details.player_out
      : null;

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[#e8fb25]">
          <ActivityIcon type={activity.type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
              {activity.title}
            </p>
            <span className="shrink-0 section-label whitespace-nowrap">
              {formatDateTime(activity.timestamp)}
            </span>
          </div>
          <p className="truncate text-xs text-[#666671]">
            {activity.league.name}
          </p>
          <p className="mt-2 text-sm text-[#9a9aa5]">{activity.description}</p>

          {(windowNumber !== null ||
            (activity.type === "transfer" && playerIn && playerOut) ||
            (activity.type === "points" && points !== null) ||
            (activity.type === "rank" && rank !== null)) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {windowNumber !== null && (
                <span className="rounded-[6px] bg-[rgba(232,251,37,0.1)] px-2 py-1 text-[#e8fb25]">
                  Window {windowNumber}
                </span>
              )}
              {activity.type === "transfer" && playerIn && playerOut && (
                <span className="rounded-[6px] bg-[rgba(255,216,107,0.1)] px-2 py-1 text-[#ffd86b]">
                  {playerOut}
                  {" → "}
                  {playerIn}
                </span>
              )}
              {activity.type === "points" && points !== null && (
                <span className="rounded-[6px] bg-[rgba(0,255,136,0.1)] px-2 py-1 text-[#00ff88]">
                  {points.toFixed(1)} pts
                </span>
              )}
              {activity.type === "rank" && rank !== null && (
                <span className="rounded-[6px] bg-[rgba(0,212,255,0.1)] px-2 py-1 text-[#00d4ff]">
                  Rank #{rank}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function RecentActivity({
  recentActivity,
  isLoading = false,
  errorMessage,
}: RecentActivityProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    if (activeFilter === "all") {
      return recentActivity;
    }
    return recentActivity.filter((item) => item.type === activeFilter);
  }, [activeFilter, recentActivity]);

  return (
    <section className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <p className="section-label">Recent Activity</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-[8px] border px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] transition-colors ${
                activeFilter === filter.value
                  ? "border-[rgba(232,251,37,0.35)] bg-[rgba(232,251,37,0.08)] text-[#e8fb25]"
                  : "border-[rgba(255,255,255,0.08)] bg-transparent text-[#9a9aa5] hover:border-[rgba(255,255,255,0.16)] hover:text-[#f0f0f0]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {isLoading && (
          <div className="my-5 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="skeleton h-16 rounded-[10px]" />
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="my-5 rounded-[10px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.06)] p-4 text-sm text-[#ff3b5c]">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length === 0 && (
          <div className="my-5 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a22] p-4 text-sm text-[#666671]">
            No activity found for this filter.
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length > 0 && (
          <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
            {filtered.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export type { TUserActivityItem as Activity };
