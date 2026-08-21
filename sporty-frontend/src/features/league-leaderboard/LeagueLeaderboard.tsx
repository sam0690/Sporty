"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, Tabs } from "@/components/ui";
import { useMe } from "@/hooks/auth/useMe";
import {
  StandingsTable,
  type StandingRow,
} from "@/features/leagues/components/StandingsTable";
import {
  notScoringReason,
  sortLeaderboardEntries,
} from "@/features/leagues/leaderboardRows";
import { UserRankCard } from "./components/UserRankCard";
import {
  WeekSelector,
  type SelectedWeek,
} from "./components/WeekSelector";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import {
  useH2HStandings,
  useLeaderboard,
  useLeague,
  useMyTeam,
  useActiveWindow,
  useSeasonState,
  usePowerRankings,
} from "@/hooks/leagues/useLeagues";
import type { TPowerRankingEntry } from "@/types";

export function LeagueLeaderboard() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const {
    data: league,
    isLoading: isLeagueLoading,
    isError: isLeagueError,
  } = useLeague(leagueId);
  const { data: myTeam, isLoading: isTeamLoading } = useMyTeam(leagueId);
  const { username } = useMe();
  const { data: activeWindow, isLoading: isWindowLoading } =
    useActiveWindow(leagueId);
  const { data: seasonState } = useSeasonState(leagueId);

  const [selectedWeek, setSelectedWeek] = useState<SelectedWeek>("overall");
  const [historical, setHistorical] = useState(true);

  // "overall" → season totals (no gameweek param); a number → that gameweek's
  // standings (resolved to the season window server-side via the gameweek arg).
  const selectedGameweek =
    selectedWeek === "overall" ? undefined : selectedWeek;
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
  } = useLeaderboard(leagueId, undefined, historical, selectedGameweek);


  // Power rankings (rank movement/streak/MOTW) are only meaningful for the
  // most recent scored window — don't attach them to an arbitrary past
  // gameweek the user has scrolled back to.
  const { data: powerRankings } = usePowerRankings(
    leagueId,
    selectedWeek === "overall",
  );
  const powerRankingsByTeam = useMemo(() => {
    const map = new Map<string, TPowerRankingEntry>();
    (powerRankings ?? []).forEach((entry) => map.set(entry.fantasy_team_id, entry));
    return map;
  }, [powerRankings]);

  // Small W-L-T badge alongside points for head-to-head leagues — the
  // Matchups tab is where the real H2H standings live, this is just a hint.
  const { data: h2hStandings } = useH2HStandings(leagueId, !!league?.is_head_to_head);
  const recordByTeam = useMemo(() => {
    const map = new Map<string, string>();
    (h2hStandings ?? []).forEach((row) =>
      map.set(row.fantasy_team_id, `${row.wins}-${row.losses}-${row.ties}`),
    );
    return map;
  }, [h2hStandings]);

  const standings = useMemo<StandingRow[]>(() => {
    if (!leaderboard) return [];
    // Rank comes from the backend or not at all — it sends null while nobody in
    // the league has scored, and fabricating a position from list order here
    // would put that number back and name a leader that doesn't exist.
    const currentGw = seasonState?.current_gw ?? activeWindow?.number ?? null;
    return sortLeaderboardEntries(leaderboard.entries, currentGw).map(
      (entry) => {
        const idle = notScoringReason(entry, currentGw);
        const power = entry.team_id
          ? powerRankingsByTeam.get(entry.team_id)
          : undefined;
        return {
          rank: idle ? null : entry.rank,
          teamId: entry.team_id,
          teamName: entry.team_name,
          manager: entry.owner_name,
          points: Number(entry.points),
          rankDelta: power?.rank_delta,
          streak: power?.streak,
          isManagerOfTheWeek: power?.manager_of_the_week,
          record: entry.team_id ? recordByTeam.get(entry.team_id) : undefined,
          pointsDeducted: Number(entry.points_deducted),
          penalties: entry.penalties?.map((p) => ({
            points_charged: Number(p.points_charged),
            reason: p.reason,
            created_at: p.created_at,
          })),
          notScoringReason: idle ?? undefined,
          eligibleFromGameweek: entry.eligible_from_gameweek,
        };
      },
    );
  }, [
    leaderboard,
    powerRankingsByTeam,
    recordByTeam,
    seasonState?.current_gw,
    activeWindow?.number,
  ]);

  // Your own row — matched by team id, or by username when you have no squad.
  // That second case is the whole point: without it the manager who most needs
  // the explanation is the one who can't find themselves on the table.
  const userTeam = useMemo(() => {
    const myRow = standings.find((row) =>
      row.teamId
        ? row.teamId === myTeam?.id
        : !!username && row.manager === username,
    );
    if (!myRow) return null;
    // Leader = top *scoring* row; standings[0] can be a non-scoring manager
    // when nobody in the league has started scoring yet.
    const topPoints = standings.find((row) => !row.notScoringReason)?.points ?? 0;
    return {
      rank: myRow.rank,
      teamName: myRow.teamName ?? "No squad yet",
      totalPoints: myRow.points,
      pointsDeducted: myRow.pointsDeducted ?? 0,
      pointsBehind: Math.round(topPoints - myRow.points),
      notScoringNote:
        myRow.notScoringReason === "no_squad"
          ? "You've joined this league but haven't built a squad, so there's nothing to score. Build one and it scores from the next gameweek onwards."
          : myRow.notScoringReason === "pending_window"
            ? `You joined after the season started, so your squad scores from gameweek ${myRow.eligibleFromGameweek}. Earlier gameweeks count as zero.`
            : undefined,
    };
  }, [myTeam?.id, username, standings]);

  // Every ACTIVE member now gets a row, so the table can legitimately contain
  // managers with no squad and midseason joiners who haven't started scoring.
  // Say so once in plain language rather than leaving it to the row badges.
  const idleCounts = useMemo(() => {
    let noSquad = 0;
    let pending = 0;
    for (const row of standings) {
      if (row.notScoringReason === "no_squad") noSquad += 1;
      if (row.notScoringReason === "pending_window") pending += 1;
    }
    return { noSquad, pending };
  }, [standings]);

  const isLoading =
    isLeagueLoading || isTeamLoading || isLeaderboardLoading || isWindowLoading;

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton />
      </section>
    );
  }

  if (isLeagueError) {
    return <ErrorState title="Failed to load league" />;
  }

  if (!league) {
    return <EmptyState title="League not found." />;
  }

  return (
    <section className="space-y-5">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 card-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <WeekSelector
            currentWeek={seasonState?.current_gw || activeWindow?.number || 1}
            totalWeeks={seasonState?.total_gw || activeWindow?.total_number || 0}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
          />
        </div>

        <div className="inline-flex rounded-[3px] border border-white/8 bg-surface-3 p-0.5">
          <Tabs
            ariaLabel="Standings mode"
            size="sm"
            value={historical ? "historical" : "live"}
            onChange={(key) => setHistorical(key === "historical")}
            items={[
              { key: "historical", label: "Historical" },
              { key: "live", label: "Live" },
            ]}
          />
        </div>
      </div>

      {userTeam && (
        <UserRankCard
          rank={userTeam.rank}
          teamName={userTeam.teamName}
          totalPoints={userTeam.totalPoints}
          pointsBehind={userTeam.pointsBehind}
          pointsDeducted={userTeam.pointsDeducted}
          notScoringNote={userTeam.notScoringNote}
        />
      )}

      {isLeaderboardError ? (
        <ErrorState title="Failed to load standings" />
      ) : standings.length === 0 ? (
        <EmptyState
          title={
            selectedWeek === "overall"
              ? "No standings available yet."
              : `No standings for gameweek ${selectedWeek} yet.`
          }
        />
      ) : (
        <>
          <StandingsTable
            standings={standings}
            userTeamId={myTeam?.id || ""}
            userName={username}
            pointsLabel={
              selectedWeek === "overall" ? "Points" : `GW${selectedWeek} Points`
            }
          />
          {(idleCounts.noSquad > 0 || idleCounts.pending > 0) && (
            <p className="px-1 text-xs leading-relaxed text-fg-3">
              Every league member is listed, including managers who aren&apos;t
              scoring yet.{" "}
              {idleCounts.noSquad > 0 && (
                <>
                  <span className="font-700 text-fg-2">
                    {idleCounts.noSquad} {idleCounts.noSquad === 1 ? "manager has" : "managers have"}{" "}
                    no squad
                  </span>{" "}
                  — they joined but haven&apos;t picked a team, so there is
                  nothing to score. They can still build one, and it scores from
                  the next gameweek onwards.{" "}
                </>
              )}
              {idleCounts.pending > 0 && (
                <>
                  <span className="font-700 text-fg-2">
                    {idleCounts.pending}{" "}
                    {idleCounts.pending === 1 ? "manager joined" : "managers joined"}{" "}
                    after the season started
                  </span>{" "}
                  — their squads start scoring from the gameweek shown on their
                  row, so earlier gameweeks count as zero for them.
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
