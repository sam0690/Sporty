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
  return "text-foreground/55";
}

function streakLabel(streak: string): string {
  if (streak.includes("🔥") || streak.includes("❄️")) {
    return streak;
  }

  return "─";
}

export function StandingsTable({
  standings,
  userTeamId,
  selectedWeek,
  weeklyStandings,
}: StandingsTableProps) {
  const weeklyMode = selectedWeek !== "overall";

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-white/5">
            {weeklyMode ? (
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Rank
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Team
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Manager
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Weekly Score
                </th>
              </tr>
            ) : (
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Rank
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Team
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Manager
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Points
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Weekly Avg
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  W-L
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-foreground/55">
                  Streak
                </th>
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
                      className={`border-b border-white/10 text-sm transition-colors hover:bg-white/8 ${isUser ? "bg-accent-primary/10" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-foreground">
                        {rankLabel(team.rank)}
                      </td>
                      <td className="px-5 py-4 font-medium text-foreground">
                        {team.teamName}
                      </td>
                      <td className="px-5 py-4 text-foreground/60">
                        {team.manager}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-foreground">
                        {team.weeklyScore}
                      </td>
                    </tr>
                  );
                })
              : standings.map((team) => {
                  const isUser = team.teamId === userTeamId;

                  return (
                    <tr
                      key={team.teamId}
                      className={`border-b border-white/10 text-sm transition-colors hover:bg-white/8 ${isUser ? "bg-accent-primary/10" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-foreground">
                        {rankLabel(team.rank)}
                      </td>
                      <td className="px-5 py-4 font-medium text-foreground">
                        {team.teamName}
                      </td>
                      <td className="px-5 py-4 text-foreground/60">
                        {team.manager}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-foreground">
                        {team.totalPoints}
                      </td>
                      <td className="px-5 py-4 text-foreground/60">
                        {team.weeklyAvg.toFixed(1)}
                      </td>
                      <td className="px-5 py-4 text-foreground/60">
                        {team.wins}-{team.losses}
                      </td>
                      <td
                        className={`px-5 py-4 font-medium ${streakClass(team.streak)}`}
                      >
                        {streakLabel(team.streak)}
                      </td>
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
