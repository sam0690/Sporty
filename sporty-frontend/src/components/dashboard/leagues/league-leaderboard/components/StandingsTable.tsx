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

function rankCellClass(rank: number): string {
  return rank === 1 ? "text-[#e8fb25]" : "text-[#f0f0f0]";
}

export function StandingsTable({
  standings,
  userTeamId,
  selectedWeek,
  weeklyStandings,
}: StandingsTableProps) {
  const weeklyMode = selectedWeek !== "overall";

  const headerCols = weeklyMode
    ? ["Rank", "Team", "Manager", "Weekly Score"]
    : ["Rank", "Team", "Manager", "Points", "Avg", "W-L", "Streak"];

  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#1d1d26]">
            <tr>
              {headerCols.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left font-barlow-condensed text-[10px] font-700 uppercase tracking-[3px] text-[#666]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {weeklyMode
              ? weeklyStandings.map((team) => {
                  const isUser = team.teamId === userTeamId;
                  return (
                    <tr
                      key={team.teamId}
                      className={`text-sm transition-colors hover:bg-[#1d1d26] ${isUser ? "bg-[rgba(232,251,37,0.05)]" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <span className={`font-bebas text-xl tracking-[2px] ${rankCellClass(team.rank)}`}>
                          {team.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                        {team.teamName}
                      </td>
                      <td className="px-5 py-3 text-[#555560]">{team.manager}</td>
                      <td className="px-5 py-3">
                        <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
                          {team.weeklyScore}
                        </span>
                      </td>
                    </tr>
                  );
                })
              : standings.map((team) => {
                  const isUser = team.teamId === userTeamId;
                  return (
                    <tr
                      key={team.teamId}
                      className={`text-sm transition-colors hover:bg-[#1d1d26] ${isUser ? "bg-[rgba(232,251,37,0.05)]" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <span className={`font-bebas text-xl tracking-[2px] ${rankCellClass(team.rank)}`}>
                          {team.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                        {team.teamName}
                      </td>
                      <td className="px-5 py-3 text-[#555560]">{team.manager}</td>
                      <td className="px-5 py-3">
                        <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
                          {team.totalPoints}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#555560]">
                        {team.weeklyAvg.toFixed(1)}
                      </td>
                      <td className="px-5 py-3 text-[#555560]">
                        {team.wins}-{team.losses}
                      </td>
                      <td className="px-5 py-3 font-barlow-condensed text-xs font-700 text-[#555560]">
                        {team.streak === "─" || !team.streak ? "─" : team.streak}
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
