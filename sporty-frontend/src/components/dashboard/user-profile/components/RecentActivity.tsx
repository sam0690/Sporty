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
    <li className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]">
            <ActivityIcon type={activity.type} />
          </span>
          <div>
            <p className="text-sm font-600 text-[#f0f0f0]">
              {activity.title}
            </p>
            <p className="text-xs text-[#f0f0f0]/50">{activity.league.name}</p>
          </div>
        </div>
        <span className="text-xs text-[#f0f0f0]/45">
          {formatDateTime(activity.timestamp)}
        </span>
      </div>

      <p className="mt-3 text-sm text-[#f0f0f0]/65">{activity.description}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-[3px] bg-[#1d1d26] px-2 py-1 text-[#555560]">
          {activity.type}
        </span>
        {windowNumber !== null && (
          <span className="rounded-[3px] bg-emerald-500/10 px-2 py-1 text-emerald-300">
            Window {windowNumber}
          </span>
        )}
        {activity.type === "transfer" && playerIn && playerOut && (
          <span className="rounded-[3px] bg-amber-500/10 px-2 py-1 text-amber-300">
            {playerOut}
            {" -> "}
            {playerIn}
          </span>
        )}
        {activity.type === "points" && points !== null && (
          <span className="rounded-[3px] bg-sky-500/10 px-2 py-1 text-sky-300">
            {points.toFixed(1)} pts
          </span>
        )}
        {activity.type === "rank" && rank !== null && (
          <span className="rounded-[3px] bg-violet-500/10 px-2 py-1 text-violet-300">
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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base text-[#f0f0f0]">
          Recent Activity
        </h3>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-[3px] px-3 py-1 text-xs transition ${
                activeFilter === filter.value
                  ? "bg-accent-primary text-black"
                  : "bg-[#1d1d26] text-[#555560] hover:bg-[#1d1d26]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
          Loading activity feed...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="mt-4 rounded-[3px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && filtered.length === 0 && (
        <div className="mt-4 rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
          No activity found for this filter.
        </div>
      )}

      {!isLoading && !errorMessage && filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </ul>
      )}
    </section>
  );
}

export type { TUserActivityItem as Activity };
