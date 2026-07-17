"use client";

import { useDashboardMainState } from "@/features/dashboard";
import { FavouritesNudge } from "./FavouritesNudge";
import { LiveMatchTicker } from "./LiveMatchTicker";
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
    pointsDeducted,
    statsLoading,
    statsError,
    mappedActivity,
    recentActivityLoading,
    recentActivityError,
    leaguesLoading,
    isSwitching,
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
          pointsDeducted={pointsDeducted}
          statsLoading={statsLoading && hasLeagues}
          isSwitching={isSwitching}
        />

        <LiveMatchTicker />

        <FavouritesNudge />

        {hasLeagues && (
          <div
            className={`mb-6 transition-opacity duration-200 ${isSwitching ? "opacity-50" : ""}`}
          >
            <GameweekBreakdown
              breakdown={dashboardStats?.gameweek_breakdown ?? []}
              isLoading={statsLoading}
              isError={Boolean(statsError)}
            />
          </div>
        )}

        <div
          className={`grid grid-cols-1 gap-6 transition-opacity duration-200 lg:grid-cols-[1.35fr_1fr] ${isSwitching ? "opacity-50" : ""}`}
        >
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
