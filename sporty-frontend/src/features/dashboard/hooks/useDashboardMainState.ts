"use client";

import { useEffect, useMemo } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import {
  useDashboardLeagueStats,
  useDashboardTeamPreview,
  useRecentActivity,
} from "@/hooks/dashboard/useDashboardData";
import { useLocalStorage } from "@/hooks/general/useLocalStorage";
import { LocalStorageKeys } from "@/lib/storage.keys";
import type { ActivityItem, OverviewStat } from "../types";

export function useDashboardMainState() {
  const { data: me, username } = useMe();
  const { data: leagues, isLoading: leaguesLoading } = useMyLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useLocalStorage<string | null>(
    LocalStorageKeys.DASHBOARD_SELECTED_LEAGUE_ID,
    null,
  );

  const leagueOptions = useMemo(
    () =>
      (leagues ?? []).map((league) => ({ id: league.id, name: league.name })),
    [leagues],
  );

  useEffect(() => {
    if (!leagueOptions.length) {
      return;
    }

    const isCurrentValid = leagueOptions.some(
      (league) => league.id === selectedLeagueId,
    );
    if (!isCurrentValid) {
      setSelectedLeagueId(leagueOptions[0].id);
    }
  }, [leagueOptions, selectedLeagueId, setSelectedLeagueId]);

  const activeLeagueId =
    selectedLeagueId &&
    leagueOptions.some((league) => league.id === selectedLeagueId)
      ? selectedLeagueId
      : (leagueOptions[0]?.id ?? null);

  const {
    previews,
    hasLeagues,
    isLoading: previewLoading,
    error: previewError,
  } = useDashboardTeamPreview(activeLeagueId);
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardLeagueStats(activeLeagueId);
  const {
    data: recentActivityData,
    isLoading: recentActivityLoading,
    error: recentActivityError,
  } = useRecentActivity(activeLeagueId);

  const userName = username || "Sporty Manager";

  const selectedLeagueName =
    leagueOptions.find((league) => league.id === activeLeagueId)?.name ??
    "League";

  // On a failed stats fetch show "—", never fake zeros.
  const statValue = (value: string) => (statsError ? "—" : value);
  const stats: OverviewStat[] = [
    {
      label: "Total Points",
      value: statValue(Math.round(dashboardStats?.total_points ?? 0).toString()),
      change: selectedLeagueName,
    },
    {
      label: "Rank",
      value: statValue(dashboardStats?.rank ? `#${dashboardStats.rank}` : "-"),
      change: selectedLeagueName,
    },
    {
      label: "Budget",
      value: statValue(`£${Number(dashboardStats?.budget ?? 0).toFixed(1)}M`),
      change: "Current budget",
    },
    {
      label: "Gameweek Points",
      value: statValue(
        Math.round(dashboardStats?.gameweek_points ?? 0).toString(),
      ),
      change: selectedLeagueName,
    },
  ];

  const pointsDeducted = dashboardStats?.points_deducted ?? 0;

  const mappedActivity: ActivityItem[] = (recentActivityData ?? []).map(
    (item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      detail: item.description,
      timestamp: item.timestamp,
      leagueName: item.league?.name,
    }),
  );

  return {
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
  };
}
