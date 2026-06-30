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
  const topScorer = players.reduce<MyTeamPlayerView | null>(
    (best, p) => (best === null || p.totalPoints > best.totalPoints ? p : best),
    null,
  );

  const stats: Array<{ label: string; value: string; accent: string }> = [
    { label: "Players", value: String(players.length), accent: "#f0f0f0" },
    { label: "Total Points", value: String(Math.round(totalPoints)), accent: "#e8fb25" },
    { label: "Squad Value", value: `$${squadValue.toFixed(1)}M`, accent: "#f0f0f0" },
    {
      label: "Top Scorer",
      value: topScorer ? `${Math.round(topScorer.totalPoints)}` : "—",
      accent: "#e8fb25",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.08)] sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#111117] px-5 py-4">
          <p
            className="font-bebas text-3xl leading-none tracking-[2px]"
            style={{ color: stat.accent }}
          >
            {stat.value}
          </p>
          <p className="section-label mt-1.5">{stat.label}</p>
          {stat.label === "Top Scorer" && topScorer && (
            <p className="mt-0.5 truncate text-xs text-[#555560]">
              {topScorer.name}
            </p>
          )}
        </div>
      ))}
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
                  ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.1)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] hover:border-[rgba(255,255,255,0.18)]"
              }`}
              aria-pressed={isActive}
            >
              <span
                className={`block font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] ${
                  isActive ? "text-[#e8fb25]" : "text-[#f0f0f0]"
                }`}
              >
                {league.name}
              </span>
              <span className="block text-xs text-[#555560]">
                {league.teamName ?? "No team yet"}
              </span>
            </button>
          );
        })}
      </div>
    ) : (
      <label className="block max-w-xl">
        <span className="mb-2 block font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
          Select league
        </span>
        <select
          value={activeLeague?.id ?? ""}
          onChange={(event) => onLeagueChange(event.target.value)}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
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
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
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
        <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[#ff8a8a]">
          Failed to load team data. Please try again.
        </div>
      ) : !hasLeagues ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center text-sm text-[#555560]">
          You are not part of any leagues yet.
        </div>
      ) : isEmptyTeam ? (
        <EmptyTeamState />
      ) : teamLeague && teamLeague.players.length > 0 ? (
        <div className="space-y-6">
          <SquadStats players={teamLeague.players} />
          <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
              <span className="section-label">Squad</span>
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
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
