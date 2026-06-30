"use client";

import { useMemo } from "react";
import {
  LeagueHistory,
  type LeagueRow,
} from "@/components/dashboard/user-profile/components/LeagueHistory";
import { ProfileHeader } from "@/components/dashboard/user-profile/components/ProfileHeader";
import {
  RecentActivity,
} from "@/components/dashboard/user-profile/components/RecentActivity";
import { StatsCards } from "@/components/dashboard/user-profile/components/StatsCards";
import { useMe } from "@/hooks/auth/useMe";
import { useUserActivity, useUserPublicStats } from "@/hooks/users/useUsers";

function toSport(value: string): LeagueRow["sport"] {
  if (
    value === "football" ||
    value === "basketball" ||
    value === "cricket" ||
    value === "multisport"
  ) {
    return value;
  }
  return "football";
}

export function UserProfileView({ userId }: { userId?: string }) {
  const { data: me } = useMe();
  const targetUserId = userId ?? me?.id ?? "";

  const { data: stats, isLoading: statsLoading } =
    useUserPublicStats(targetUserId);
  const {
    data: activityFeed,
    isLoading: activityLoading,
    error: activityError,
  } = useUserActivity(targetUserId);

  const leagues = useMemo<LeagueRow[]>(
    () =>
      (stats?.leagues ?? []).map((league, index) => ({
        id: index + 1,
        name: league.name,
        sport: toSport(league.sport),
        rank: league.rank ?? 0,
        points: Number(league.points),
      })),
    [stats?.leagues],
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 text-[#f0f0f0]">
      <p className="mb-6 section-label">
        {targetUserId === me?.id ? "Your Profile" : "Player Profile"}
      </p>

      {statsLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="h-32 animate-pulse rounded-[3px] bg-[#1d1d26]" />
            <div className="h-40 animate-pulse rounded-[3px] bg-[#1d1d26]" />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <div className="h-64 animate-pulse rounded-[3px] bg-[#1d1d26]" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <ProfileHeader
              name={stats?.username ?? "Player"}
              avatar={stats?.avatar_url ?? ""}
              joinDate={stats?.created_at ?? ""}
            />
            <StatsCards
              totalPoints={stats?.total_points ?? 0}
              totalLeagues={stats?.total_leagues ?? 0}
              bestRank={stats?.best_rank ?? null}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <LeagueHistory leagues={leagues} />
            <RecentActivity
              recentActivity={activityFeed ?? []}
              isLoading={activityLoading}
              errorMessage={activityError?.message ?? null}
            />
          </div>
        </div>
      )}
    </section>
  );
}
