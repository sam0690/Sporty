"use client";

import { useMemo } from "react";
import {
  LeagueHistory,
  type LeagueRow,
} from "./LeagueHistory";
import { ProfileHero } from "./ProfileHero";
import {
  RecentActivity,
} from "./RecentActivity";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { useMe } from "@/hooks/auth/useMe";
import {
  useUserActivity,
  useUserPublicStatsByUsername,
} from "@/hooks/users/useUsers";

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

export function UserProfileView({ username }: { username?: string }) {
  const { data: me } = useMe();
  const resolvedUsername = username || me?.username || "";

  const { data: stats, isLoading: statsLoading } =
    useUserPublicStatsByUsername(resolvedUsername);
  const targetUserId = stats?.user_id ?? "";
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

  const label =
    targetUserId && targetUserId === me?.id ? "Your Profile" : "Player Profile";

  if (statsLoading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-6 py-8 text-fg-1">
        <div className="skeleton h-40 rounded-[3px]" />
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="skeleton h-72 rounded-[3px]" />
          <div className="skeleton h-72 rounded-[3px]" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 text-fg-1">
      <ProfileHero
        label={label}
        name={stats?.username ?? "Player"}
        avatar={stats?.avatar_url ?? ""}
        joinDate={stats?.created_at ?? ""}
        totalPoints={stats?.total_points ?? 0}
        totalLeagues={stats?.total_leagues ?? 0}
        bestRank={stats?.best_rank ?? null}
        action={
          resolvedUsername ? (
            <ShareProfileButton path={`/u/${resolvedUsername}`} />
          ) : null
        }
      />

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <LeagueHistory leagues={leagues} />
        <RecentActivity
          recentActivity={activityFeed ?? []}
          isLoading={activityLoading}
          errorMessage={activityError?.message ?? null}
        />
      </div>
    </section>
  );
}
