"use client";

import { EmptyPlayers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import { EmptyTeamState } from "@/components/dashboard/my-team/components/EmptyTeamState";
import { LeagueGroup } from "@/components/dashboard/my-team/components/LeagueGroup";
import { TeamHeader } from "@/components/dashboard/my-team/components/TeamHeader";
import type { MyTeamLeagueView, MyTeamPlayerView, LeagueOption } from "../types";

function SquadStats({ players }: { players: MyTeamPlayerView[] }) {
  const totalPoints = players.reduce((sum, p) => sum + p.totalPoints, 0);
  const squadValue = players.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  // "Top Scorer" is this gameweek's leader, not the season leader — otherwise
  // it just duplicates the "Total Points" stat next to it.
  const topScorer = players.reduce<MyTeamPlayerView | null>(
    (best, p) => (best === null || p.gameweekPoints > best.gameweekPoints ? p : best),
    null,
  );

  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-1 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="num font-bebas text-5xl leading-none tracking-[1px] text-accent sm:text-6xl">
            {Math.round(totalPoints)}
          </p>
          <p className="section-label mt-1.5">Total Points</p>
        </div>

        <span className="hidden h-10 w-px bg-white/8 sm:block" />

        <div>
          <p className="num font-bebas text-2xl leading-none tracking-[1px] text-fg-1">
            {players.length}
          </p>
          <p className="section-label mt-1.5">Players</p>
        </div>

        <div>
          <p className="num font-bebas text-2xl leading-none tracking-[1px] text-fg-1">
            ${squadValue.toFixed(1)}M
          </p>
          <p className="section-label mt-1.5">Squad Value</p>
        </div>

        {topScorer && (
          <div>
            <p className="num font-bebas text-2xl leading-none tracking-[1px] text-fg-1">
              {Math.round(topScorer.gameweekPoints)}
            </p>
            <p className="section-label mt-1.5">
              Top Scorer <span className="text-fg-3 normal-case">· {topScorer.name}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

type MyTeamViewProps = {
  username?: string;
  leagueOptions: LeagueOption[];
  activeLeague: LeagueOption | null;
  selectedLeagueName: string;
  selectedTeamName?: string;
  teamLeague: MyTeamLeagueView | null;
  totals: { totalPlayers: number };
  isLoading: boolean;
  hasLeagues: boolean;
  isEmptyTeam: boolean;
  leaguesError: unknown;
  selectedTeamError: unknown;
  onLeagueChange: (leagueId: string) => void;
};

export function MyTeamView({
  leagueOptions,
  activeLeague,
  selectedLeagueName,
  selectedTeamName,
  teamLeague,
  totals,
  isLoading,
  hasLeagues,
  isEmptyTeam,
  leaguesError,
  selectedTeamError,
  onLeagueChange,
}: MyTeamViewProps) {
  const leagueSelector = hasLeagues ? (
    leagueOptions.length <= 4 ? (
      <div className="flex flex-wrap gap-2">
        {leagueOptions.map((league) => {
          const isActive = league.id === activeLeague?.id;

          return (
            <button
              key={league.id}
              type="button"
              onClick={() => onLeagueChange(league.id)}
              className={`rounded-[3px] border px-4 py-2.5 text-left transition-colors ${
                isActive
                  ? "border-accent/35 bg-accent/8"
                  : "border-white/8 bg-surface-1 hover:border-white/16"
              }`}
              aria-pressed={isActive}
            >
              <span
                className={`block font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] ${
                  isActive ? "text-accent" : "text-fg-1"
                }`}
              >
                {league.name}
              </span>
              <span className="block text-xs text-fg-3">
                {league.teamName ?? "No team yet"}
              </span>
            </button>
          );
        })}
      </div>
    ) : (
      <label className="block max-w-xl">
        <span className="mb-2 block font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          Select league
        </span>
        <select
          value={activeLeague?.id ?? ""}
          onChange={(event) => onLeagueChange(event.target.value)}
          className="w-full rounded-[3px] border border-white/8 bg-surface-1 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
          style={{ colorScheme: "dark" }}
          aria-label="Choose league"
        >
          {leagueOptions.map((league) => (
            <option key={league.id} value={league.id}>
              {league.label}
            </option>
          ))}
        </select>
      </label>
    )
  ) : null;

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-fg-1">
      <TeamHeader
        totalPlayers={totals.totalPlayers}
        leagueName={selectedLeagueName}
        teamName={selectedTeamName}
      />

      {leagueSelector}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </div>
      ) : leaguesError || selectedTeamError ? (
        <div className="rounded-[3px] border border-danger/25 bg-danger/6 p-4 text-sm text-danger">
          Failed to load team data. Please try again.
        </div>
      ) : !hasLeagues ? (
        <div className="rounded-[3px] border border-white/8 bg-surface-1 p-8 text-center text-sm text-fg-3">
          You are not part of any leagues yet.
        </div>
      ) : isEmptyTeam ? (
        <EmptyTeamState />
      ) : teamLeague && teamLeague.players.length > 0 ? (
        <div className="space-y-6">
          <SquadStats players={teamLeague.players} />
          <section className="overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-5 py-4">
              <span className="section-label">Squad</span>
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-fg-3">
                {teamLeague.teamName}
              </span>
            </header>
            <div className="p-5">
              <LeagueGroup
                leagueName={teamLeague.leagueName}
                players={teamLeague.players}
                sports={teamLeague.sports}
              />
            </div>
          </section>
        </div>
      ) : (
        <EmptyPlayers />
      )}
    </section>
  );
}
