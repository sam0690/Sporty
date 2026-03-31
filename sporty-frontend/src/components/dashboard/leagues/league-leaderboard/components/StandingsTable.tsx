"use client";

type Standing = {
  rank: number;
  teamId: string;
  teamName: string;
  manager: string;
  totalPoints: number;
  weeklyAvg: number;
  wins: number;
  losses: number;
  streak: string;
  group?: string;
  weeklyScores?: Record<number, number>;
};

type WeeklyStanding = {
  rank: number;
  teamId: string;
  teamName: string;
  manager: string;
  weeklyScore: number;
};

type StandingsTableProps = {
  standings: Standing[];
  userTeamId: string;
  selectedWeek: number | "overall";
  weeklyStandings: WeeklyStanding[];
};

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function streakClass(streak: string): string {
  if (streak.includes("🔥")) return "text-orange-500";
  if (streak.includes("❄️")) return "text-blue-400";
  return "text-gray-400";
}

function streakLabel(streak: string): string {
  if (streak.includes("🔥") || streak.includes("❄️")) {
    return streak;
  }

  return "─";
}

export function StandingsTable({ standings, userTeamId, selectedWeek, weeklyStandings }: StandingsTableProps) {
  const weeklyMode = selectedWeek !== "overall";

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white [animation:fade-soft_0.2s_ease]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            {weeklyMode ? (
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Team</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Manager</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Weekly Score</th>
              </tr>
            ) : (
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Team</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Manager</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Points</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Weekly Avg</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">W-L</th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Streak</th>
              </tr>
            )}
          </thead>

          <tbody>
            {weeklyMode
              ? weeklyStandings.map((team) => {
                  const isUser = team.teamId === userTeamId;

                  return (
                    <tr
                      key={team.teamId}
                      className={`border-b border-gray-100 text-sm transition-colors hover:bg-gray-50 ${isUser ? "bg-primary-50/50" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-gray-900">{rankLabel(team.rank)}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{team.teamName}</td>
                      <td className="px-5 py-4 text-gray-600">{team.manager}</td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{team.weeklyScore}</td>
                    </tr>
                  );
                })
              : standings.map((team) => {
                  const isUser = team.teamId === userTeamId;

                  return (
                    <tr
                      key={team.teamId}
                      className={`border-b border-gray-100 text-sm transition-colors hover:bg-gray-50 ${isUser ? "bg-primary-50/50" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-gray-900">{rankLabel(team.rank)}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{team.teamName}</td>
                      <td className="px-5 py-4 text-gray-600">{team.manager}</td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{team.totalPoints}</td>
                      <td className="px-5 py-4 text-gray-600">{team.weeklyAvg.toFixed(1)}</td>
                      <td className="px-5 py-4 text-gray-600">{team.wins}-{team.losses}</td>
                      <td className={`px-5 py-4 font-medium ${streakClass(team.streak)}`}>{streakLabel(team.streak)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { Standing, WeeklyStanding };
