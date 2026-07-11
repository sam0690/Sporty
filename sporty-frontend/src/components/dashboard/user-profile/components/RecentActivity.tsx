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
        <span className="mt-0.5 text-accent">
          <ActivityIcon type={activity.type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
              {activity.title}
            </p>
            <span className="shrink-0 section-label whitespace-nowrap">
              {formatDateTime(activity.timestamp)}
            </span>
          </div>
          <p className="truncate text-xs text-fg-3">
            {activity.league.name}
          </p>
          <p className="mt-2 text-sm text-fg-2">{activity.description}</p>

          {(windowNumber !== null ||
            (activity.type === "transfer" && playerIn && playerOut) ||
            (activity.type === "points" && points !== null) ||
            (activity.type === "rank" && rank !== null)) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {windowNumber !== null && (
                <span className="rounded-[3px] bg-accent/10 px-2 py-1 text-accent">
                  Window {windowNumber}
                </span>
              )}
              {activity.type === "transfer" && playerIn && playerOut && (
                <span className="rounded-[3px] bg-warning/10 px-2 py-1 text-warning">
                  {playerOut}
                  {" → "}
                  {playerIn}
                </span>
              )}
              {activity.type === "points" && points !== null && (
                <span className="rounded-[3px] bg-success/10 px-2 py-1 text-success">
                  {points.toFixed(1)} pts
                </span>
              )}
              {activity.type === "rank" && rank !== null && (
                <span className="rounded-[3px] bg-info/10 px-2 py-1 text-info">
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
    <section className="overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-5 py-4">
        <p className="section-label">Recent Activity</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-[3px] border px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] transition-colors ${
                activeFilter === filter.value
                  ? "border-accent/35 bg-accent/8 text-accent"
                  : "border-white/8 bg-transparent text-fg-2 hover:border-white/16 hover:text-fg-1"
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
              <div key={index} className="skeleton h-16 rounded-[3px]" />
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="my-5 rounded-[3px] border border-danger/25 bg-danger/6 p-4 text-sm text-danger">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length === 0 && (
          <div className="my-5 rounded-[3px] border border-white/8 bg-surface-2 p-4 text-sm text-fg-3">
            No activity found for this filter.
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length > 0 && (
          <ul className="divide-y divide-white/6">
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
