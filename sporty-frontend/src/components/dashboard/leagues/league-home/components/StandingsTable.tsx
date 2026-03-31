"use client";

type Standing = {
  rank: number;
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
};

type StandingsTableProps = {
  standings: Standing[];
  userTeamId: string;
};

function rankClass(rank: number): string {
  if (rank === 1) {
    return "text-[#C3B299]";
  }

  if (rank === 2) {
    return "text-[#CBD4C2]";
  }

  if (rank === 3) {
    return "text-[#50514F]";
  }

  return "text-text-primary";
}

function rankLabel(rank: number): string {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return String(rank);
}

export function StandingsTable({ standings, userTeamId }: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface-100 shadow-card">
      <h2 className="border-b border-border px-4 py-3 text-lg font-semibold text-text-primary">
        Standings
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface-200">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-text-secondary">Rank</th>
              <th className="p-3 text-left text-sm font-medium text-text-secondary">Team Name</th>
              <th className="p-3 text-left text-sm font-medium text-text-secondary">Points</th>
              <th className="p-3 text-left text-sm font-medium text-text-secondary">Wins</th>
              <th className="p-3 text-left text-sm font-medium text-text-secondary">Losses</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;

              return (
                <tr
                  key={team.teamId}
                  className={`border-b border-border hover:bg-surface-100 ${isUser ? "bg-primary-50" : ""}`}
                >
                  <td className={`p-3 font-semibold ${rankClass(team.rank)} ${isUser ? "border-l-4 border-primary-500" : ""}`}>
                    {rankLabel(team.rank)}
                  </td>
                  <td className="p-3 text-text-primary">{team.teamName}</td>
                  <td className="p-3 text-text-primary">{team.points}</td>
                  <td className="p-3 text-text-primary">{team.wins}</td>
                  <td className="p-3 text-text-primary">{team.losses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { Standing };
