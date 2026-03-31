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
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white [animation:fade-soft_0.2s_ease]">
      <h2 className="p-5 pb-0 text-md font-medium text-gray-800">
        Standings
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Team</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Points</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">W-L</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;

              return (
                <tr
                  key={team.teamId}
                  className={`border-b border-gray-100 text-sm transition-colors hover:bg-gray-50 ${isUser ? "bg-gray-50/50" : ""}`}
                >
                  <td className={`px-5 py-3 font-medium ${rankClass(team.rank)}`}>
                    {rankLabel(team.rank)}
                  </td>
                  <td className="px-5 py-3 text-gray-900">{team.teamName}</td>
                  <td className="px-5 py-3 text-gray-900">{team.points}</td>
                  <td className="px-5 py-3 text-gray-600">{team.wins}-{team.losses}</td>
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
