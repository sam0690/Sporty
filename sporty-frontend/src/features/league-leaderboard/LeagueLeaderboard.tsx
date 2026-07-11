"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, Tabs } from "@/components/ui";
import {
  StandingsTable,
  type StandingRow,
} from "@/features/leagues/components/StandingsTable";
import { UserRankCard } from "./components/UserRankCard";
import {
  WeekSelector,
  type SelectedWeek,
} from "./components/WeekSelector";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import {
  useLeaderboard,
  useLeague,
  useMyTeam,
  useActiveWindow,
  usePowerRankings,
} from "@/hooks/leagues/useLeagues";
import type { TPowerRankingEntry } from "@/types";

export function LeagueLeaderboard() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { data: league, isLoading: isLeagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: isTeamLoading } = useMyTeam(leagueId);
  const { data: activeWindow, isLoading: isWindowLoading } =
    useActiveWindow(leagueId);

  const [selectedWeek, setSelectedWeek] = useState<SelectedWeek>("overall");
  const [historical, setHistorical] = useState(true);

  // "overall" → season totals (no gameweek param); a number → that gameweek's
  // standings (resolved to the season window server-side via the gameweek arg).
  const selectedGameweek =
    selectedWeek === "overall" ? undefined : selectedWeek;
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(
    leagueId,
    undefined,
    historical,
    selectedGameweek,
  );


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

  const standings = useMemo<StandingRow[]>(() => {
    if (!leaderboard) return [];
    // Backend rank can be null until the ranking job runs (e.g. an in-progress
    // gameweek); fall back to points-sorted position so the table is sensible.
    return [...leaderboard.entries]
      .sort((a, b) => Number(b.points) - Number(a.points))
      .map((entry, index) => {
        const power = powerRankingsByTeam.get(entry.team_id);
        return {
          rank: entry.rank ?? index + 1,
          teamId: entry.team_id,
          teamName: entry.team_name,
          manager: entry.owner_name,
          points: Number(entry.points),
          rankDelta: power?.rank_delta,
          streak: power?.streak,
          isManagerOfTheWeek: power?.manager_of_the_week,
        };
      });
  }, [leaderboard, powerRankingsByTeam]);

  const userTeam = useMemo(() => {
    if (!myTeam || !standings.length) return null;
    const teamInStandings = standings.find((s) => s.teamId === myTeam.id);
    if (!teamInStandings) return null;
    const topPoints = standings[0].points;
    return {
      rank: teamInStandings.rank,
      teamName: teamInStandings.teamName,
      totalPoints: teamInStandings.points,
      pointsBehind: Math.round(topPoints - teamInStandings.points),
    };
  }, [myTeam, standings]);

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

  if (!league) {
    return <EmptyState title="League not found." />;
  }

  return (
    <section className="space-y-5">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 card-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <WeekSelector
            currentWeek={activeWindow?.number || 1}
            totalWeeks={activeWindow?.total_number || 16}
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
        />
      )}

      {standings.length === 0 ? (
        <EmptyState
          title={
            selectedWeek === "overall"
              ? "No standings available yet."
              : `No standings for gameweek ${selectedWeek} yet.`
          }
        />
      ) : (
        <StandingsTable
          standings={standings}
          userTeamId={myTeam?.id || ""}
          pointsLabel={
            selectedWeek === "overall" ? "Points" : `GW${selectedWeek} Points`
          }
        />
      )}
    </section>
  );
}
