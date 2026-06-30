"use client";

type StandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  manager: string;
  points: number;
};

type StandingsTableProps = {
  standings: StandingRow[];
  userTeamId: string;
  // Header label for the points column — "Points" for the season total,
  // "Gameweek Points" when a single gameweek is selected.
  pointsLabel?: string;
};

function rankCellClass(rank: number): string {
  return rank === 1 ? "text-[#e8fb25]" : "text-[#f0f0f0]";
}

export function StandingsTable({
  standings,
  userTeamId,
  pointsLabel = "Points",
}: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#1d1d26]">
            <tr>
              {["Rank", "Team", "Manager", pointsLabel].map((col) => (
                <th
                  key={col}
                  className={`px-5 py-3 font-barlow-condensed text-[10px] font-700 uppercase tracking-[3px] text-[#666] ${
                    col === pointsLabel ? "text-right" : "text-left"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;
              return (
                <tr
                  key={team.teamId}
                  className={`text-sm transition-colors hover:bg-[#1d1d26] ${
                    isUser ? "bg-[rgba(232,251,37,0.05)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <span
                      className={`font-bebas text-xl tracking-[2px] ${rankCellClass(team.rank)}`}
                    >
                      {team.rank}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                    {team.teamName}
                    {isUser && (
                      <span className="ml-2 section-label text-[#c8d85a]">You</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#555560]">{team.manager}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
                      {Math.round(team.points)}
                    </span>
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

export type { StandingRow };
