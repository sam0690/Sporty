"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { useMyTeam as useLeagueMyTeam, useUserLeagues } from "@/hooks/my-team";
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

  const {
    data: selectedTeam,
    isLoading: selectedTeamLoading,
    error: selectedTeamError,
  } = useLeagueMyTeam(activeLeague?.id ?? null);

  const teamLeague = useMemo(
    () => mapTeamLeagueView(activeLeague, selectedTeam ?? null),
    [activeLeague, selectedTeam],
  );

  const totals = useMemo(() => {
    const totalPlayers = teamLeague?.players.length ?? 0;

    return { totalPlayers };
  }, [teamLeague]);

  const handleLeagueChange = (leagueId: string) => {
    router.replace(`${pathname}?league=${leagueId}`, { scroll: false });
  };

  return {
    username,
    leagueOptions,
    activeLeague,
    selectedLeagueName: activeLeague?.name ?? "League",
    selectedTeamName:
      teamLeague?.teamName ?? activeLeague?.teamName ?? undefined,
    teamLeague,
    totals,
    isLoading: leaguesLoading || (selectedTeamLoading && !teamLeague),
    hasLeagues: leagueOptions.length > 0,
    isEmptyTeam: Boolean(activeLeague?.id) && selectedTeam === null,
    leaguesError,
    selectedTeamError,
    onLeagueChange: handleLeagueChange,
  };
}
