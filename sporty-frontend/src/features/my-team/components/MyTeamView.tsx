"use client";

import { Trophy, Users } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import { EmptyTeamState } from "./EmptyTeamState";
import { LeagueGroup } from "./LeagueGroup";
import { PlayerCard } from "./PlayerCard";
import { SquadSpine } from "./SquadSpine";
import { TeamSummaryCard } from "./TeamSummaryCard";
import type { MyTeamLeagueView, LeagueOption } from "../types";

type MyTeamViewProps = {
  username?: string;
  leagueOptions: LeagueOption[];
  activeLeague: LeagueOption | null;
  selectedLeagueName: string;
  selectedTeamName?: string;
  teamLeague: MyTeamLeagueView | null;
  rank: number | null;
  seasonPoints: number;
  lineupDeadlineAt: string | null;
  hasLineup: boolean;
  live: boolean;
  isLoading: boolean;
  isSwitching: boolean;
  hasLeagues: boolean;
  isEmptyTeam: boolean;
  leaguesError: unknown;
  selectedTeamError: unknown;
  onLeagueChange: (leagueId: string) => void;
};

export function MyTeamView({
  leagueOptions,
  activeLeague,
  selectedTeamName,
  teamLeague,
  rank,
  seasonPoints,
  lineupDeadlineAt,
  hasLineup,
  live,
  isLoading,
  isSwitching,
  hasLeagues,
  isEmptyTeam,
  leaguesError,
  selectedTeamError,
  onLeagueChange,
}: MyTeamViewProps) {
  const players = teamLeague?.players ?? [];
  const starters = players.filter((p) => p.isStarter);
  const bench = players.filter((p) => !p.isStarter);
  const startersLabel = teamLeague?.hasLineupSplit ? "Starting XI" : "Squad";

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-fg-1 sm:px-6">
      {hasLeagues && (
        <SquadSpine
          leagueOptions={leagueOptions}
          activeLeague={activeLeague}
          teamName={selectedTeamName}
          players={players}
          rank={rank}
          seasonPoints={seasonPoints}
          lineupDeadlineAt={lineupDeadlineAt}
          hasLineup={hasLineup}
          live={live}
          isSwitching={isSwitching}
          onLeagueChange={onLeagueChange}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </div>
      ) : leaguesError || selectedTeamError ? (
        <ErrorState title="Failed to load team data" />
      ) : !hasLeagues ? (
        <EmptyState
          icon={Trophy}
          title="No leagues yet"
          description="Create or join a league to start building your squad."
          actions={[
            { label: "Create league", href: "/create-league", variant: "primary" },
            { label: "Join league", href: "/join-league" },
          ]}
        />
      ) : isEmptyTeam ? (
        <EmptyTeamState leagueId={activeLeague?.id} />
      ) : teamLeague && players.length > 0 ? (
        <div
          className={`space-y-6 transition-opacity duration-200 ${
            isSwitching ? "opacity-50" : ""
          }`}
          aria-busy={isSwitching}
        >
          {teamLeague.hasLineupSplit && <TeamSummaryCard players={players} />}

          <section className="overflow-hidden card-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-5 py-4">
              <span className="section-label">{startersLabel}</span>
              <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
                {starters.length} {starters.length === 1 ? "player" : "players"}
              </span>
            </header>
            <div className="p-5">
              <LeagueGroup
                leagueName={teamLeague.leagueName}
                players={starters}
                sports={teamLeague.sports}
              />
            </div>
          </section>

          {bench.length > 0 && (
            <section className="overflow-hidden card-surface opacity-[0.85]">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-5 py-4">
                <span className="section-label">Bench</span>
                <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
                  {bench.length}
                </span>
              </header>
              <div className="space-y-2 p-5">
                {bench.map((player) => (
                  <PlayerCard
                    key={player.id}
                    id={player.id}
                    name={player.name}
                    sport={player.sport}
                    position={player.position}
                    realTeam={player.realTeam}
                    photoUrl={player.photoUrl}
                    realTeamLogoUrl={player.realTeamLogoUrl}
                    nationality={player.nationality}
                    flagUrl={player.flagUrl}
                    cost={player.cost}
                    totalPoints={player.totalPoints}
                    avgPoints={player.avgPoints}
                    gameweekPoints={player.gameweekPoints}
                    gameweekBreakdown={player.gameweekBreakdown}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No players yet"
          description="Make transfers to add players to your team"
          actions={[
            { label: "Browse Transfers", href: "/transfers", variant: "secondary" },
          ]}
        />
      )}
    </section>
  );
}
