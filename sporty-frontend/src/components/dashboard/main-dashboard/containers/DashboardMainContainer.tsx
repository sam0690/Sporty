"use client";

import { useAuth } from "@/context/auth-context";
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
  const { user } = useAuth();

  const userName = user?.name ?? "Sporty Manager";
  const userId = user?.id ?? "1";

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-1 sm:px-3">
      <main>
        <Topbar userName={userName} userId={userId} avatar={user?.avatar} />
        <OverviewCards stats={OVERVIEW_STATS} />

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.35fr_1fr]">
          <TeamPreview players={TEAM_PREVIEW_PLAYERS} />
          <RecentActivity items={RECENT_ACTIVITY} />
        </div>
      </main>
    </div>
  );
}
