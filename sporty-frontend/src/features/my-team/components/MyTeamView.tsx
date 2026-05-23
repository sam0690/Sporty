"use client";

import { EmptyPlayers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import { EmptyTeamState } from "@/components/dashboard/my-team/components/EmptyTeamState";
import { LeagueGroup } from "@/components/dashboard/my-team/components/LeagueGroup";
import { TeamHeader } from "@/components/dashboard/my-team/components/TeamHeader";
import type { MyTeamLeagueView, LeagueOption } from "../types";

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
  username,
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
      <div className="mt-6 flex flex-wrap gap-2">
        {leagueOptions.map((league) => {
          const isActive = league.id === activeLeague?.id;

          return (
            <button
              key={league.id}
              type="button"
              onClick={() => onLeagueChange(league.id)}
              className={`rounded-full border px-4 py-2 text-left text-sm transition-all duration-200 ${
                isActive
                  ? "border-accent-primary/50 bg-accent-primary/15 text-foreground"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
              }`}
              aria-pressed={isActive}
            >
              <span className="block font-medium">{league.name}</span>
              <span className="block text-xs text-slate-400">
                {league.teamName ?? "No team yet"}
              </span>
            </button>
          );
        })}
      </div>
    ) : (
      <label className="mt-6 block max-w-xl">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Select league
        </span>
        <select
          value={activeLeague?.id ?? ""}
          onChange={(event) => onLeagueChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-surface-strong px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-accent-primary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/25"
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
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-foreground">
      <div className="mb-5">
        <p className="text-sm text-slate-400">
          Manager: {username || "Sporty User"}
        </p>
      </div>

      <TeamHeader
        totalPlayers={totals.totalPlayers}
        leagueName={selectedLeagueName}
        teamName={selectedTeamName}
      />

      {leagueSelector}

      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </div>
      ) : leaguesError || selectedTeamError ? (
        <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load team data. Please try again.
        </div>
      ) : !hasLeagues ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          You are not part of any leagues yet.
        </div>
      ) : isEmptyTeam ? (
        <div className="mt-8">
          <EmptyTeamState />
        </div>
      ) : teamLeague && teamLeague.players.length > 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-400">
              Team: {teamLeague.teamName}
            </p>
            <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-medium text-slate-300">
              League {teamLeague.leagueName}
            </span>
          </div>

          <LeagueGroup
            leagueName={teamLeague.leagueName}
            players={teamLeague.players}
            sports={teamLeague.sports}
          />
        </div>
      ) : (
        <div className="mt-8">
          <EmptyPlayers />
        </div>
      )}
    </section>
  );
}
