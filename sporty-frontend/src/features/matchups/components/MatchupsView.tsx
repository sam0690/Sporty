"use client";

import { useParams } from "next/navigation";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { useH2HStandings, useLeague, useMatchups, useMyTeam } from "@/hooks/leagues/useLeagues";
import { H2HStandingsTable } from "./H2HStandingsTable";
import type { TMatchup } from "@/types";

function MatchupCard({ matchup, myTeamId }: { matchup: TMatchup; myTeamId?: string }) {
  const isMine = matchup.home_team.id === myTeamId || matchup.away_team?.id === myTeamId;
  const isBye = matchup.result === "bye";
  const isPending = matchup.result === null;

  return (
    <div className={`card-surface p-5 ${isMine ? "border-accent/40" : ""}`}>
      <p className="section-label mb-3 text-center text-fg-3">
        {isBye ? "Bye" : isPending ? "This Week" : "Final"}
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-700 text-fg-1">{matchup.home_team.name}</p>
          <p className="num mt-1 text-3xl font-700 text-fg-1">
            {matchup.home_points ?? "–"}
          </p>
        </div>
        {!isBye && (
          <>
            <span className="shrink-0 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-3">
              vs
            </span>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-700 text-fg-1">{matchup.away_team?.name}</p>
              <p className="num mt-1 text-3xl font-700 text-fg-1">
                {matchup.away_points ?? "–"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function MatchupsView() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { data: league } = useLeague(leagueId);
  const { data: myTeam } = useMyTeam(leagueId);
  const enabled = !!league?.is_head_to_head && league?.status === "active";

  const { data: matchups, isLoading: matchupsLoading } = useMatchups(leagueId, undefined, enabled);
  const { data: standings, isLoading: standingsLoading } = useH2HStandings(leagueId, enabled);

  if (league && !enabled) {
    return (
      <div className="card-surface p-8 text-center text-sm text-fg-3">
        {league.is_head_to_head
          ? "Matchups open once the league is active."
          : "This league doesn't use head-to-head standings."}
      </div>
    );
  }

  const myMatchup = matchups?.find(
    (m) => m.home_team.id === myTeam?.id || m.away_team?.id === myTeam?.id,
  );
  const others = (matchups ?? []).filter((m) => m.id !== myMatchup?.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label mb-3">Your Matchup</p>
        {matchupsLoading ? (
          <TableSkeleton />
        ) : myMatchup ? (
          <MatchupCard matchup={myMatchup} myTeamId={myTeam?.id} />
        ) : (
          <p className="text-sm text-fg-3">No matchup this window.</p>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <p className="section-label mb-3">Around the League</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((m) => (
              <MatchupCard key={m.id} matchup={m} myTeamId={myTeam?.id} />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="section-label mb-3">Standings</p>
        {standingsLoading ? (
          <TableSkeleton />
        ) : (
          <H2HStandingsTable rows={standings ?? []} myTeamId={myTeam?.id} />
        )}
      </div>
    </div>
  );
}
