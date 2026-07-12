"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { PlayerAvatar, Tabs } from "@/components/ui";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import {
  useFullSchedule,
  useH2HStandings,
  useLeague,
  useMatchups,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { FullScheduleView } from "./FullScheduleView";
import { H2HStandingsTable } from "./H2HStandingsTable";
import type { TMatchup } from "@/types";

type ScheduleView = "week" | "schedule";

function fmtPoints(points: string | null): string {
  if (points === null) return "–";
  const n = Number(points);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

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
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <PlayerAvatar
            name={matchup.home_team.user.username}
            photoUrl={matchup.home_team.user.avatar_url}
            size="md"
          />
          <p className="mt-2 truncate text-sm font-700 text-fg-1">{matchup.home_team.name}</p>
          <p className="num mt-1 text-3xl font-700 text-fg-1">
            {fmtPoints(matchup.home_points)}
          </p>
        </div>
        {!isBye && (
          <>
            <span className="shrink-0 rounded-full border border-white/12 px-2.5 py-1 font-sans text-[11px] font-700 uppercase tracking-[2px] text-fg-2">
              vs
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <PlayerAvatar
                name={matchup.away_team?.user.username ?? matchup.away_team?.name ?? "?"}
                photoUrl={matchup.away_team?.user.avatar_url}
                size="md"
              />
              <p className="mt-2 truncate text-sm font-700 text-fg-1">{matchup.away_team?.name}</p>
              <p className="num mt-1 text-3xl font-700 text-fg-1">
                {fmtPoints(matchup.away_points)}
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
  const [view, setView] = useState<ScheduleView>("week");

  const { data: matchups, isLoading: matchupsLoading } = useMatchups(
    leagueId,
    undefined,
    enabled && view === "week",
  );
  const { data: fullSchedule, isLoading: scheduleLoading } = useFullSchedule(
    leagueId,
    enabled && view === "schedule",
  );
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
      <div className="flex justify-end">
        <Tabs
          ariaLabel="Matchups view"
          size="sm"
          value={view}
          onChange={(key) => setView(key as ScheduleView)}
          items={[
            { key: "week", label: "This Week" },
            { key: "schedule", label: "Full Schedule" },
          ]}
        />
      </div>

      {view === "schedule" ? (
        <div>
          <p className="section-label mb-3">Full Schedule</p>
          {scheduleLoading ? (
            <TableSkeleton />
          ) : (
            <FullScheduleView matchups={fullSchedule ?? []} myTeamId={myTeam?.id} />
          )}
        </div>
      ) : (
        <>
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
        </>
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
