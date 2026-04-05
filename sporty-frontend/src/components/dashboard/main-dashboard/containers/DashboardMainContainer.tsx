"use client";

import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { Topbar } from "@/components/dashboard/main-dashboard/components/Topbar";
import { OverviewCards } from "@/components/dashboard/main-dashboard/components/OverviewCards";
import { TeamPreview } from "@/components/dashboard/main-dashboard/components/TeamPreview";
import { RecentActivity } from "@/components/dashboard/main-dashboard/components/RecentActivity";
import {
  OVERVIEW_STATS,
  RECENT_ACTIVITY,
  TEAM_PREVIEW_PLAYERS,
} from "@/components/dashboard/main-dashboard/constants/dashboardData";

export function DashboardMainContainer() {
  const { data: me, username } = useMe();
  const { data: leagues, isLoading: leaguesLoading } = useMyLeagues();

  const userName = username || "Sporty Manager";

  // Example of using real data: update one of the stats to show league count
  const stats = [...OVERVIEW_STATS];
  if (leagues) {
    stats[0] = { ...stats[0], label: "My Leagues", value: leagues.length.toString() };
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <main>
          <Topbar
            userName={userName}
            avatar={me?.avatar_url ?? ""}
            userId={me?.id ?? ""}
          />
          <OverviewCards stats={stats} />

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.35fr_1fr]">
            <TeamPreview players={TEAM_PREVIEW_PLAYERS} />
            <RecentActivity items={RECENT_ACTIVITY} />
          </div>
        </main>
      </div>
    </>
  );
}
