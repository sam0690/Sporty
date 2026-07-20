"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { useMyTeam as useLeagueMyTeam, useUserLeagues } from "@/hooks/my-team";
import { useLineup } from "@/hooks/leagues/useLeagues";
import { mapLeagueOptions, mapTeamLeagueView } from "../utils";

export function useMyTeamDashboard() {
  const { username } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    data: leagues,
    isLoading: leaguesLoading,
    error: leaguesError,
  } = useUserLeagues();

  const searchLeagueId = searchParams.get("league");

  const leagueOptions = useMemo(() => {
    return mapLeagueOptions(leagues ?? []);
  }, [leagues]);

  useEffect(() => {
    if (!leagueOptions.length) {
      return;
    }

    const isValidSelection =
      searchLeagueId &&
      leagueOptions.some((league) => league.id === searchLeagueId);

    if (!isValidSelection) {
      const fallbackLeagueId = leagueOptions[0].id;
      router.replace(`${pathname}?league=${fallbackLeagueId}`, {
        scroll: false,
      });
    }
  }, [leagueOptions, pathname, router, searchLeagueId]);

  const activeLeague = useMemo(
    () =>
      leagueOptions.find((league) => league.id === searchLeagueId) ??
      leagueOptions[0] ??
      null,
    [leagueOptions, searchLeagueId],
  );

  // Attention/triage fields already ride along on the leagues list — no extra
  // per-league window request needed for the deadline spine.
  const activeLeagueRow = useMemo(
    () => (leagues ?? []).find((league) => league.id === activeLeague?.id),
    [leagues, activeLeague?.id],
  );

  const {
    data: selectedTeam,
    isLoading: selectedTeamLoading,
    isPlaceholderData: isSwitching,
    error: selectedTeamError,
  } = useLeagueMyTeam(activeLeague?.id ?? null);

  // Starter/captain flags for the selected squad. Errors are non-fatal: the
  // view degrades to a single roster group when no lineup is available.
  const { data: lineup } = useLineup(activeLeague?.id ?? "");

  const teamLeague = useMemo(
    () =>
      mapTeamLeagueView(
        activeLeague,
        selectedTeam ?? null,
        lineup ?? null,
      ),
    [activeLeague, selectedTeam, lineup],
  );

  const handleLeagueChange = (leagueId: string) => {
    router.replace(`${pathname}?league=${leagueId}`, { scroll: false });
  };

  const myTeamRow = activeLeagueRow?.my_team;

  return {
    username,
    leagueOptions,
    activeLeague,
    selectedLeagueName: activeLeague?.name ?? "League",
    selectedTeamName:
      teamLeague?.teamName ?? activeLeague?.teamName ?? undefined,
    teamLeague,
    // Deadline spine + standing, straight off the leagues list row.
    rank: myTeamRow?.rank ?? null,
    seasonPoints: Number(myTeamRow?.points ?? 0),
    lineupDeadlineAt: myTeamRow?.lineup_deadline_at ?? null,
    hasLineup: Boolean(myTeamRow?.has_lineup),
    live: Boolean(myTeamRow?.live),
    isLoading: leaguesLoading || (selectedTeamLoading && !teamLeague),
    // League switch keeps the previous squad rendered (dimmed) — see
    // placeholderData in useMyTeam.
    isSwitching,
    hasLeagues: leagueOptions.length > 0,
    isEmptyTeam:
      Boolean(activeLeague?.id) && selectedTeam === null && !isSwitching,
    leaguesError,
    selectedTeamError,
    onLeagueChange: handleLeagueChange,
  };
}
