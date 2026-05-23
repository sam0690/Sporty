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
import { OVERVIEW_STATS } from "@/components/dashboard/main-dashboard/constants/dashboardData";
import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";

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
  const { data: dashboardStats, isLoading: statsLoading } =
    useDashboardLeagueStats(activeLeagueId);
  const {
    data: recentActivityData,
    isLoading: recentActivityLoading,
    error: recentActivityError,
  } = useRecentActivity(activeLeagueId);

  const userName = username || "Sporty Manager";

  const stats = [...OVERVIEW_STATS];
  const selectedLeagueName =
    leagueOptions.find((league) => league.id === activeLeagueId)?.name ??
    "League";

  stats[0] = {
    label: "Total Points",
    value: Math.round(dashboardStats?.total_points ?? 0).toString(),
    change: selectedLeagueName,
  };
  stats[1] = {
    label: "Rank",
    value: dashboardStats?.rank ? `#${dashboardStats.rank}` : "-",
    change: selectedLeagueName,
  };
  stats[2] = {
    label: "Budget",
    value: `$${Number(dashboardStats?.budget ?? 0).toFixed(1)}M`,
    change: "Current budget",
  };
  stats[3] = {
    label: "Gameweek Points",
    value: Math.round(dashboardStats?.gameweek_points ?? 0).toString(),
    change: selectedLeagueName,
  };

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
    statsLoading,
    mappedActivity,
    recentActivityLoading,
    recentActivityError,
    leaguesLoading,
  };
}
