"use client";

import { useMemo } from "react";
import { Carousel } from "@mantine/carousel";
import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues, useMyTeamsForLeagues } from "@/hooks/leagues/useLeagues";
import { LeagueGroup } from "@/components/dashboard/my-team/components/LeagueGroup";
import { TeamHeader } from "@/components/dashboard/my-team/components/TeamHeader";
import type { Sport } from "@/components/dashboard/my-team/components/PlayerCard";
import { EmptyPlayers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";

type TeamLeague = {
  leagueId: string;
  leagueName: string;
  sports: Sport[];
  players: {
    id: string;
    name: string;
    sport: Sport;
    position: string;
    realTeam: string;
    cost: string;
    totalPoints: number;
    avgPoints: number;
  }[];
  teamName: string;
};

const normalizeSport = (sportName?: string): Sport => {
  const normalized = sportName?.trim().toLowerCase();
  if (
    normalized === "football" ||
    normalized === "basketball" ||
    normalized === "cricket"
  ) {
    return normalized;
  }
  return "football";
};

export function MyTeam() {
  const { username } = useMe();
  const {
    data: leagues,
    isLoading: leaguesLoading,
    error: leaguesError,
  } = useMyLeagues();

  const leagueIds = useMemo(
    () => (leagues ?? []).map((league) => league.id),
    [leagues],
  );
  const teamQueries = useMyTeamsForLeagues(leagueIds);

  const teams = useMemo<TeamLeague[]>(() => {
    if (!leagues?.length) {
      return [];
    }

    return leagues
      .map((league, index) => {
        const teamData = teamQueries[index]?.data;
        if (!teamData) {
          return null;
        }

        const rows = teamData.team_players ?? teamData.players ?? [];
        const players = rows.map((teamPlayer) => ({
          id: teamPlayer.player.id,
          name: teamPlayer.player.name,
          sport: normalizeSport(teamPlayer.player.sport?.name),
          position: teamPlayer.player.position,
          realTeam: teamPlayer.player.real_team,
          cost: teamPlayer.player.cost,
          totalPoints: 0,
          avgPoints: 0,
        }));

        const sports = Array.from(
          new Set(players.map((player) => player.sport)),
        );

        return {
          leagueId: league.id,
          leagueName: league.name,
          sports,
          teamName: teamData.name,
          players,
        };
      })
      .filter((team): team is TeamLeague => Boolean(team));
  }, [leagues, teamQueries]);

  const isTeamLoading = teamQueries.some((query) => query.isLoading);
  const teamError = teamQueries.find((query) => query.error)?.error;
  const isLoading = leaguesLoading || isTeamLoading;

  const totals = useMemo(() => {
    const allPlayers = teams.flatMap((team) => team.players);
    const totalPlayers = allPlayers.length;

    return {
      totalPlayers,
    };
  }, [teams]);

  const hasPlayers = totals.totalPlayers > 0;
  const hasLeagues = (leagues?.length ?? 0) > 0;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-black">
      <div className="mb-5">
        <p className="text-sm text-secondary">
          Manager: {username || "Sporty User"}
        </p>
      </div>

      <TeamHeader totalPlayers={totals.totalPlayers} />

      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </div>
      ) : leaguesError || teamError ? (
        <div className="mt-8 rounded-md border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          Failed to load team data. Please try again.
        </div>
      ) : !hasLeagues ? (
        <div className="mt-8 rounded-md border border-border bg-white p-6 text-sm text-secondary">
          You are not part of any leagues yet.
        </div>
      ) : hasPlayers ? (
        <div className="mt-8">
          <Carousel
            withIndicators
            slideSize="100%"
            slideGap="md"
            emblaOptions={{ loop: teams.length > 1, align: "start" }}
          >
            {teams.map((team) => (
              <Carousel.Slide key={team.leagueId}>
                <div className="rounded-lg border border-accent/20 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-secondary">
                      Team: {team.teamName}
                    </p>
                    <span className="rounded-full border border-border bg-[#F4F4F9] px-2.5 py-1 text-xs font-medium text-secondary">
                      League {team.leagueName}
                    </span>
                  </div>

                  <LeagueGroup
                    leagueName={team.leagueName}
                    players={team.players}
                    sports={team.sports}
                  />
                </div>
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      ) : (
        <div className="mt-8">
          <EmptyPlayers />
        </div>
      )}
    </section>
  );
}
