"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Sidebar } from "@/components/dashboard/main-dashboard/components/Sidebar";
import { Topbar } from "@/components/dashboard/main-dashboard/components/Topbar";
import { OverviewCards } from "@/components/dashboard/main-dashboard/components/OverviewCards";
import { TeamPreview } from "@/components/dashboard/main-dashboard/components/TeamPreview";
import { RecentActivity } from "@/components/dashboard/main-dashboard/components/RecentActivity";
import {
  DASHBOARD_NAV_ITEMS,
  OVERVIEW_STATS,
  RECENT_ACTIVITY,
  TEAM_PREVIEW_PLAYERS,
} from "@/components/dashboard/main-dashboard/constants/dashboardData";

export function DashboardMainContainer() {
  const pathname = usePathname();
  const { user } = useAuth();

  const userName = user?.name ?? "Sporty Manager";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Sidebar items={DASHBOARD_NAV_ITEMS} currentPath={pathname} />

        <main>
          <Topbar userName={userName} avatar={user?.avatar} />
          <OverviewCards stats={OVERVIEW_STATS} />

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.35fr_1fr]">
            <TeamPreview players={TEAM_PREVIEW_PLAYERS} />
            <RecentActivity items={RECENT_ACTIVITY} />
          </div>
        </main>
      </div>
    </div>
  );
}
