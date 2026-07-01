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
    <li className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#DC2626]">
            <ActivityIcon type={activity.type} />
          </span>
          <div className="min-w-0">
            <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
              {activity.title}
            </p>
            <p className="truncate text-xs text-[#6B7280]">
              {activity.league.name}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-[#6B7280]">
          {formatDateTime(activity.timestamp)}
        </span>
      </div>

      <p className="mt-3 text-sm text-[#6B7280]">{activity.description}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {windowNumber !== null && (
          <span className="rounded-[3px] bg-[rgba(220,38,38,0.1)] px-2 py-1 text-[#DC2626]">
            Window {windowNumber}
          </span>
        )}
        {activity.type === "transfer" && playerIn && playerOut && (
          <span className="rounded-[3px] bg-[rgba(255,216,107,0.1)] px-2 py-1 text-[#CA8A04]">
            {playerOut}
            {" → "}
            {playerIn}
          </span>
        )}
        {activity.type === "points" && points !== null && (
          <span className="rounded-[3px] bg-[rgba(76,175,80,0.12)] px-2 py-1 text-[#16A34A]">
            {points.toFixed(1)} pts
          </span>
        )}
        {activity.type === "rank" && rank !== null && (
          <span className="rounded-[3px] bg-[rgba(0,212,255,0.1)] px-2 py-1 text-[#0891B2]">
            Rank #{rank}
          </span>
        )}
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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
        <p className="section-label">Recent Activity</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-[3px] border px-2.5 py-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] transition-colors ${
                activeFilter === filter.value
                  ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
                  : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#0B1220]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {isLoading && (
          <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 text-sm text-[#6B7280]">
            Loading activity feed…
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[#DC2626]">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length === 0 && (
          <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 text-sm text-[#6B7280]">
            No activity found for this filter.
          </div>
        )}

        {!isLoading && !errorMessage && filtered.length > 0 && (
          <ul className="space-y-3">
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
