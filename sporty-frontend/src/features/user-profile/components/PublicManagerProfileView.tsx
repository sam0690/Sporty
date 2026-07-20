"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LeagueHistory, type LeagueRow } from "./LeagueHistory";
import { ProfileHeader } from "./ProfileHeader";
import { StatsCards } from "./StatsCards";
import { usePublicManagerStatsByUsername } from "@/hooks/users/useUsers";

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

/** Shareable, no-login manager profile — reached via /u/[id]. Reuses the
 * same building blocks as the in-app profile (UserProfileView), minus the
 * activity feed (too noisy/private for a public share page). */
export function PublicManagerProfileView({ username }: { username: string }) {
  const { data: stats, isLoading } = usePublicManagerStatsByUsername(username);

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
    <section className="mx-auto w-full max-w-4xl px-6 py-10 text-fg-1 sm:py-14">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="skeleton h-32 rounded-[3px]" />
            <div className="skeleton h-40 rounded-[3px]" />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <div className="skeleton h-64 rounded-[3px]" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <ProfileHeader
              name={stats?.username ?? "Manager"}
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
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 rounded-[3px] border border-accent/22 bg-accent/4 p-8 text-center sm:p-12">
        <p className="font-display text-3xl tracking-[-0.02em] text-fg-1 sm:text-4xl">
          Think you can beat {stats?.username ?? "them"}?
        </p>
        <p className="max-w-md text-sm text-fg-2">
          Build a fantasy squad, set your lineup, and score from every match — across
          football, basketball and cricket.
        </p>
        <Link
          href="/register"
          className="mt-1 inline-flex items-center gap-1.5 rounded-[3px] bg-accent px-6 py-3 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright hover:no-underline"
        >
          Get Started Free <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
