"use client";

import { useDashboardMainState } from "@/features/dashboard";
import { Topbar } from "@/components/dashboard/main-dashboard/components/Topbar";
import { OverviewCards } from "@/components/dashboard/main-dashboard/components/OverviewCards";
import { GameweekBreakdown } from "@/components/dashboard/main-dashboard/components/GameweekBreakdown";
import { TeamPreview } from "@/components/dashboard/main-dashboard/components/TeamPreview";
import { RecentActivity } from "@/components/dashboard/main-dashboard/components/RecentActivity";

export function DashboardMainContainer() {
  const {
    me,
    username: userName,
    leagueOptions,
    activeLeagueId,
    setSelectedLeagueId,
    previews,
    hasLeagues,
    previewLoading,
    previewError,
    dashboardStats,
    stats,
    statsLoading,
    mappedActivity,
    recentActivityLoading,
    recentActivityError,
    leaguesLoading,
  } = useDashboardMainState();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <main>
        <Topbar
          userName={userName}
          avatar={me?.avatar_url ?? ""}
          userId={me?.id ?? ""}
          leagues={leagueOptions}
          selectedLeagueId={activeLeagueId}
          onLeagueChange={setSelectedLeagueId}
        />
        <OverviewCards stats={stats} isLoading={statsLoading && hasLeagues} />

        {hasLeagues && (
          <div className="mb-6">
            <GameweekBreakdown
              breakdown={dashboardStats?.gameweek_breakdown ?? []}
              isLoading={statsLoading}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
          <TeamPreview
            slides={previews}
            isLoading={leaguesLoading || previewLoading}
            isError={Boolean(previewError)}
            hasLeagues={hasLeagues}
          />
          <RecentActivity
            items={mappedActivity}
            isLoading={
              leaguesLoading ||
              (Boolean(activeLeagueId) && recentActivityLoading)
            }
            isError={Boolean(recentActivityError)}
          />
        </div>
      </main>
    </div>
  );
}
