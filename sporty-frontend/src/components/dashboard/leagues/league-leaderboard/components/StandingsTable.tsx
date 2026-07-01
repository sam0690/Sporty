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
  return rank === 1 ? "text-[#DC2626]" : "text-[#0B1220]";
}

export function StandingsTable({
  standings,
  userTeamId,
  pointsLabel = "Points",
}: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] animate-fade-soft">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#F3F4F7]">
            <tr>
              {["Rank", "Team", "Manager", pointsLabel].map((col) => (
                <th
                  key={col}
                  className={`px-5 py-3 font-barlow-condensed text-[10px] font-bold uppercase tracking-[3px] text-[#666] ${
                    col === pointsLabel ? "text-right" : "text-left"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[rgba(11,18,32,0.05)]">
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;
              return (
                <tr
                  key={team.teamId}
                  className={`text-sm transition-colors hover:bg-[#F3F4F7] ${
                    isUser ? "bg-[rgba(220,38,38,0.05)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <span
                      className={`font-bebas text-xl tracking-[2px] ${rankCellClass(team.rank)}`}
                    >
                      {team.rank}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
                    {team.teamName}
                    {isUser && (
                      <span className="ml-2 section-label text-[#B91C1C]">You</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">{team.manager}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-bebas text-xl tracking-[1px] text-[#DC2626]">
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
