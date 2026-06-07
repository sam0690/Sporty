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

function rankDisplay(rank: number): { text: string; className: string } {
  if (rank === 1) return { text: String(rank), className: "text-[#e8fb25]" };
  return { text: String(rank), className: "text-[#f0f0f0]" };
}

export function StandingsTable({ standings, userTeamId }: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <h2 className="font-barlow-condensed text-xs font-700 uppercase tracking-[3px] text-[#666]">
          Standings
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#1d1d26]">
            <tr>
              {["Rank", "Team", "Points", "W-L"].map((col) => (
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
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;
              const { text, className } = rankDisplay(team.rank);

              return (
                <tr
                  key={team.teamId}
                  className={`text-sm transition-colors hover:bg-[#1d1d26] ${isUser ? "bg-[rgba(232,251,37,0.05)]" : ""}`}
                >
                  <td className="px-5 py-3">
                    <span className={`font-bebas text-xl tracking-[2px] ${className}`}>
                      {text}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#f0f0f0]">{team.teamName}</td>
                  <td className="px-5 py-3">
                    <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
                      {team.points}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#555560]">
                    {team.wins}-{team.losses}
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

export type { Standing };
