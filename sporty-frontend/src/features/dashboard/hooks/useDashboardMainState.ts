"use client";

import { useEffect, useMemo } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import {
  useDashboardLeagueStats,
  useDashboardTeamPreview,
  useRecentActivity,
} from "@/hooks/dashboard/useDashboardData";
import { useEditableWindow } from "@/hooks/leagues/useLeagueCore";
import { useLocalStorage } from "@/hooks/general/useLocalStorage";
import { deriveCompetitionType } from "@/hooks/leagues/useLeagueCompetitionMode";
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
    isSwitching: previewSwitching,
    error: previewError,
  } = useDashboardTeamPreview(activeLeagueId);
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    isPlaceholderData: statsSwitching,
    error: statsError,
  } = useDashboardLeagueStats(activeLeagueId);
  const {
    data: recentActivityData,
    isLoading: recentActivityLoading,
    isPlaceholderData: activitySwitching,
    error: recentActivityError,
  } = useRecentActivity(activeLeagueId);

  // The next not-yet-locked window drives the deadline spine's countdown + CTA.
  const { data: editableWindow } = useEditableWindow(activeLeagueId ?? "");

  // Optimistic league switch: previous league's data stays rendered (via
  // keepPreviousData in the queries) and the UI dims until fresh data lands.
  const isSwitching = previewSwitching || statsSwitching || activitySwitching;

  const userName = username || "Sporty Manager";

  const selectedLeagueName =
    leagueOptions.find((league) => league.id === activeLeagueId)?.name ??
    "League";

  const activeLeague =
    (leagues ?? []).find((league) => league.id === activeLeagueId) ?? null;
  const isDraftLeague = deriveCompetitionType(activeLeague) === "draft";

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
    // Draft leagues have no budget — rosters are built by picks, not purchases.
    ...(isDraftLeague
      ? []
      : [
          {
            label: "Budget",
            value: statValue(
              `£${Number(dashboardStats?.budget ?? 0).toFixed(1)}M`,
            ),
            change: "Current budget",
          },
        ]),
    {
      label: "Gameweek Points",
      value: statValue(
        Math.round(dashboardStats?.gameweek_points ?? 0).toString(),
      ),
      change: selectedLeagueName,
    },
  ];

  // API serializes Decimals as strings; coerce before arithmetic/toFixed.
  const pointsDeducted = Number(dashboardStats?.points_deducted ?? 0);

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
    isSwitching,
    // Deadline spine
    lineupDeadlineAt: editableWindow?.lineup_deadline_at ?? null,
    lineupLocked: editableWindow?.lineup_locked ?? false,
    hasLineup: previews.length > 0,
  };
}
