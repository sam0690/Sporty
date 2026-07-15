"use client";

import { useDashboardMainState } from "@/features/dashboard";
import { Topbar } from "./Topbar";
import { GameweekBreakdown } from "./GameweekBreakdown";
import { TeamPreview } from "./TeamPreview";
import { RecentActivity } from "./RecentActivity";

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
    gameweekPointsDeducted,
    statsLoading,
    statsError,
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
          stats={stats}
          gameweekPointsDeducted={gameweekPointsDeducted}
          statsLoading={statsLoading && hasLeagues}
        />

        {hasLeagues && (
          <div className="mb-6">
            <GameweekBreakdown
              breakdown={dashboardStats?.gameweek_breakdown ?? []}
              isLoading={statsLoading}
              isError={Boolean(statsError)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
          <TeamPreview
            slides={previews}
            isLoading={leaguesLoading || previewLoading}
            isError={Boolean(previewError)}
            hasLeagues={hasLeagues}
            activeLeagueId={activeLeagueId}
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
