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
  return "text-text-secondary";
}

export function StandingsTable({ standings, userTeamId, selectedWeek, weeklyStandings }: StandingsTableProps) {
  const weeklyMode = selectedWeek !== "overall";

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface-100 shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface-200">
            {weeklyMode ? (
              <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Rank</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Team Name</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Manager</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Weekly Score</th>
              </tr>
            ) : (
              <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Rank</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Team Name</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Manager</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Total Points</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Weekly Avg</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Wins</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Losses</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Streak</th>
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
                      className={`border-b border-border hover:bg-surface-100 ${isUser ? "bg-primary-50 border-l-4 border-primary-500" : ""}`}
                    >
                      <td className="p-3 font-semibold text-text-primary">{rankLabel(team.rank)}</td>
                      <td className="p-3 font-medium text-text-primary">{team.teamName}</td>
                      <td className="p-3 text-text-secondary">{team.manager}</td>
                      <td className="p-3 font-semibold text-primary-600">{team.weeklyScore}</td>
                    </tr>
                  );
                })
              : standings.map((team) => {
                  const isUser = team.teamId === userTeamId;

                  return (
                    <tr
                      key={team.teamId}
                      className={`border-b border-border hover:bg-surface-100 ${isUser ? "bg-primary-50 border-l-4 border-primary-500" : ""}`}
                    >
                      <td className="p-3 font-semibold text-text-primary">{rankLabel(team.rank)}</td>
                      <td className="p-3 font-medium text-text-primary">{team.teamName}</td>
                      <td className="p-3 text-text-secondary">{team.manager}</td>
                      <td className="p-3 font-semibold text-primary-600">{team.totalPoints}</td>
                      <td className="p-3 text-text-primary">{team.weeklyAvg.toFixed(1)}</td>
                      <td className="p-3 text-text-primary">{team.wins}</td>
                      <td className="p-3 text-text-primary">{team.losses}</td>
                      <td className={`p-3 font-medium ${streakClass(team.streak)}`}>{team.streak}</td>
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
