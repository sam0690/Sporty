"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { EmptyState } from "@/components/dashboard/leagues/league-leaderboard/components/EmptyState";
import { LeaderboardFilters } from "@/components/dashboard/leagues/league-leaderboard/components/LeaderboardFilters";
import {
  LeaderboardHeader,
  type Sport,
} from "@/components/dashboard/leagues/league-leaderboard/components/LeaderboardHeader";
import {
  StandingsTable,
  type Standing,
  type WeeklyStanding,
} from "@/components/dashboard/leagues/league-leaderboard/components/StandingsTable";
import {
  StatsHighlight,
  type StatsHighlights,
} from "@/components/dashboard/leagues/league-leaderboard/components/StatsHighlight";
import { UserRankCard } from "@/components/dashboard/leagues/league-leaderboard/components/UserRankCard";
import {
  WeekSelector,
  type SelectedWeek,
} from "@/components/dashboard/leagues/league-leaderboard/components/WeekSelector";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";

type LeaderboardData = {
  leagueId: string;
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
  userTeamId: string;
  userTeam: {
    rank: number;
    teamName: string;
    totalPoints: number;
    wins: number;
    losses: number;
    pointsBehind: number;
  };
  statsHighlights: StatsHighlights;
  groups: string[];
  standings: Standing[];
};

const mockLeaderboards: Record<string, LeaderboardData> = {
  "1": {
    leagueId: "1",
    leagueName: "Premier League Champions",
    sport: "football",
    currentWeek: 3,
    totalWeeks: 16,
    userTeamId: "team1",
    userTeam: {
      rank: 2,
      teamName: "Goal Rush",
      totalPoints: 212,
      wins: 1,
      losses: 1,
      pointsBehind: 33,
    },
    statsHighlights: {
      topScorer: { name: "Lionel Messi", team: "Dunk FC", points: 87 },
      highestWeeklyScore: { team: "Dunk FC", score: 98, week: 2 },
      closestMatch: { matchup: "Goal Rush vs FC Legends", difference: 5 },
    },
    groups: ["Overall"],
    standings: [
      {
        rank: 1,
        teamId: "team2",
        teamName: "Dunk FC",
        manager: "Mike T.",
        totalPoints: 245,
        weeklyAvg: 81.7,
        wins: 2,
        losses: 0,
        streak: "🔥2",
        group: "Overall",
        weeklyScores: { 1: 74, 2: 98, 3: 73 },
      },
      {
        rank: 2,
        teamId: "team1",
        teamName: "Goal Rush",
        manager: "John D.",
        totalPoints: 212,
        weeklyAvg: 70.7,
        wins: 1,
        losses: 1,
        streak: "❄️1",
        group: "Overall",
        weeklyScores: { 1: 70, 2: 66, 3: 76 },
      },
      {
        rank: 3,
        teamId: "team3",
        teamName: "FC United",
        manager: "Sarah K.",
        totalPoints: 198,
        weeklyAvg: 66.0,
        wins: 0,
        losses: 2,
        streak: "❄️2",
        group: "Overall",
        weeklyScores: { 1: 68, 2: 65, 3: 65 },
      },
      {
        rank: 4,
        teamId: "team4",
        teamName: "City FC",
        manager: "Alex R.",
        totalPoints: 187,
        weeklyAvg: 62.3,
        wins: 0,
        losses: 2,
        streak: "❄️2",
        group: "Overall",
        weeklyScores: { 1: 64, 2: 59, 3: 64 },
      },
    ],
  },
  "2": {
    leagueId: "2",
    leagueName: "NBA Fantasy 2025",
    sport: "basketball",
    currentWeek: 5,
    totalWeeks: 20,
    userTeamId: "team1",
    userTeam: {
      rank: 1,
      teamName: "Dunk Masters",
      totalPoints: 642,
      wins: 4,
      losses: 1,
      pointsBehind: 0,
    },
    statsHighlights: {
      topScorer: { name: "Nikola Jokic", team: "Dunk Masters", points: 142 },
      highestWeeklyScore: { team: "Dunk Masters", score: 158, week: 3 },
      closestMatch: { matchup: "Dunk Masters vs Hoop Kings", difference: 2 },
    },
    groups: ["Overall", "East", "West"],
    standings: [
      {
        rank: 1,
        teamId: "team1",
        teamName: "Dunk Masters",
        manager: "John D.",
        totalPoints: 642,
        weeklyAvg: 128.4,
        wins: 4,
        losses: 1,
        streak: "🔥3",
        group: "East",
        weeklyScores: { 1: 118, 2: 122, 3: 158, 4: 119, 5: 125 },
      },
      {
        rank: 2,
        teamId: "team2",
        teamName: "Hoop Kings",
        manager: "Mike T.",
        totalPoints: 598,
        weeklyAvg: 119.6,
        wins: 3,
        losses: 2,
        streak: "🔥1",
        group: "West",
        weeklyScores: { 1: 110, 2: 120, 3: 126, 4: 114, 5: 128 },
      },
      {
        rank: 3,
        teamId: "team3",
        teamName: "Air Ballers",
        manager: "Sarah K.",
        totalPoints: 567,
        weeklyAvg: 113.4,
        wins: 2,
        losses: 3,
        streak: "❄️2",
        group: "East",
        weeklyScores: { 1: 108, 2: 116, 3: 113, 4: 119, 5: 111 },
      },
    ],
  },
  "3": {
    leagueId: "3",
    leagueName: "Cricket World Cup",
    sport: "cricket",
    currentWeek: 4,
    totalWeeks: 12,
    userTeamId: "team3",
    userTeam: {
      rank: 3,
      teamName: "Six Hitters",
      totalPoints: 387,
      wins: 2,
      losses: 2,
      pointsBehind: 45,
    },
    statsHighlights: {
      topScorer: { name: "Virat Kohli", team: "Six Hitters", points: 94 },
      highestWeeklyScore: { team: "Boundary Blasters", score: 112, week: 2 },
      closestMatch: { matchup: "Six Hitters vs Spin Kings", difference: 3 },
    },
    groups: ["Overall"],
    standings: [
      {
        rank: 1,
        teamId: "team1",
        teamName: "Boundary Blasters",
        manager: "Mike T.",
        totalPoints: 432,
        weeklyAvg: 108.0,
        wins: 3,
        losses: 1,
        streak: "🔥2",
        group: "Overall",
        weeklyScores: { 1: 104, 2: 112, 3: 103, 4: 113 },
      },
      {
        rank: 2,
        teamId: "team2",
        teamName: "Spin Kings",
        manager: "Sarah K.",
        totalPoints: 398,
        weeklyAvg: 99.5,
        wins: 2,
        losses: 2,
        streak: "❄️1",
        group: "Overall",
        weeklyScores: { 1: 98, 2: 102, 3: 101, 4: 97 },
      },
      {
        rank: 3,
        teamId: "team3",
        teamName: "Six Hitters",
        manager: "John D.",
        totalPoints: 387,
        weeklyAvg: 96.8,
        wins: 2,
        losses: 2,
        streak: "🔥1",
        group: "Overall",
        weeklyScores: { 1: 93, 2: 95, 3: 98, 4: 101 },
      },
    ],
  },
  "4": {
    leagueId: "4",
    leagueName: "Ultimate All-Stars",
    sport: "multisport",
    currentWeek: 3,
    totalWeeks: 16,
    userTeamId: "team1",
    userTeam: {
      rank: 2,
      teamName: "CrossSport Kings",
      totalPoints: 897,
      wins: 2,
      losses: 1,
      pointsBehind: 45,
    },
    statsHighlights: {
      topScorer: {
        name: "Nikola Jokic",
        team: "CrossSport Kings",
        points: 142,
      },
      highestWeeklyScore: { team: "AllStar United", score: 312, week: 2 },
      closestMatch: {
        matchup: "CrossSport Kings vs AllStar United",
        difference: 8,
      },
    },
    groups: ["Overall", "Group A", "Group B"],
    standings: [
      {
        rank: 1,
        teamId: "team2",
        teamName: "AllStar United",
        manager: "Mike T.",
        totalPoints: 942,
        weeklyAvg: 314.0,
        wins: 3,
        losses: 0,
        streak: "🔥3",
        group: "Group A",
        weeklyScores: { 1: 308, 2: 312, 3: 322 },
      },
      {
        rank: 2,
        teamId: "team1",
        teamName: "CrossSport Kings",
        manager: "John D.",
        totalPoints: 897,
        weeklyAvg: 299.0,
        wins: 2,
        losses: 1,
        streak: "🔥1",
        group: "Group A",
        weeklyScores: { 1: 294, 2: 297, 3: 306 },
      },
      {
        rank: 3,
        teamId: "team3",
        teamName: "Global Legends",
        manager: "Sarah K.",
        totalPoints: 856,
        weeklyAvg: 285.3,
        wins: 1,
        losses: 2,
        streak: "❄️1",
        group: "Group B",
        weeklyScores: { 1: 280, 2: 287, 3: 289 },
      },
    ],
  },
};

export function LeagueLeaderboard() {
  const params = useParams<{ id: string }>();
  const { username } = useMe();

  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";
  const leaderboard = mockLeaderboards[leagueId] ?? mockLeaderboards["1"];

  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<SelectedWeek>("overall");
  const [selectedGroup, setSelectedGroup] = useState("Overall");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    setSelectedWeek("overall");
    setSelectedGroup("Overall");
  }, [leagueId]);

  const filteredStandings = useMemo(() => {
    if (selectedGroup === "Overall") {
      return leaderboard.standings;
    }

    return leaderboard.standings.filter((team) => team.group === selectedGroup);
  }, [leaderboard.standings, selectedGroup]);

  const weeklyStandings = useMemo<WeeklyStanding[]>(() => {
    if (selectedWeek === "overall") {
      return [];
    }

    const rows = filteredStandings.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      manager: team.manager,
      weeklyScore: team.weeklyScores?.[selectedWeek] ?? 0,
    }));

    rows.sort((a, b) => b.weeklyScore - a.weeklyScore);

    return rows.map((row, index) => ({
      rank: index + 1,
      ...row,
    }));
  }, [filteredStandings, selectedWeek]);

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton />
      </section>
    );
  }

  if (leaderboard.standings.length === 0) {
    return (
      <EmptyState message="No leaderboard data available for this league." />
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <p className="text-sm text-gray-500">
        Manager: {username || "Sporty User"}
      </p>

      <NavigationTabs
        activeTab="leaderboard"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <LeaderboardHeader
        leagueName={leaderboard.leagueName}
        sport={leaderboard.sport}
        currentWeek={leaderboard.currentWeek}
        totalWeeks={leaderboard.totalWeeks}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector
          currentWeek={leaderboard.currentWeek}
          totalWeeks={leaderboard.totalWeeks}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
        />

        <LeaderboardFilters
          selectedGroup={selectedGroup}
          groups={leaderboard.groups}
          onGroupChange={setSelectedGroup}
        />
      </div>

      <StatsHighlight
        topScorer={leaderboard.statsHighlights.topScorer}
        highestWeeklyScore={leaderboard.statsHighlights.highestWeeklyScore}
        closestMatch={leaderboard.statsHighlights.closestMatch}
      />

      <UserRankCard
        rank={leaderboard.userTeam.rank}
        teamName={leaderboard.userTeam.teamName}
        totalPoints={leaderboard.userTeam.totalPoints}
        wins={leaderboard.userTeam.wins}
        losses={leaderboard.userTeam.losses}
        pointsBehind={leaderboard.userTeam.pointsBehind}
      />

      {filteredStandings.length === 0 ? (
        <EmptyState message="No teams found for the selected group." />
      ) : (
        <StandingsTable
          standings={filteredStandings}
          userTeamId={leaderboard.userTeamId}
          selectedWeek={selectedWeek}
          weeklyStandings={weeklyStandings}
        />
      )}
    </section>
  );
}
