"use client";

import type { TLeaderboardEntry } from "@/types/league";

type StandingsTableProps = {
  entries: TLeaderboardEntry[];
  userTeamId: string;
  isLoading?: boolean;
};

export function StandingsTable({
  entries,
  userTeamId,
  isLoading,
}: StandingsTableProps) {
  // Backend rank can be null until the ranking job runs; fall back to position
  // in points-sorted order so the table always shows a sensible standing.
  const ranked = [...entries]
    .sort((a, b) => Number(b.points) - Number(a.points))
    .map((entry, index) => ({ ...entry, displayRank: entry.rank ?? index + 1 }));

  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <h2 className="font-barlow-condensed text-xs font-700 uppercase tracking-[3px] text-[#666]">
          Standings
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-[3px] bg-[#1d1d26]"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="p-6 text-sm text-[#555560]">
          No standings yet — they appear once teams are scored for a gameweek.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#1d1d26]">
              <tr>
                {["Rank", "Team", "Manager", "Points"].map((col) => (
                  <th
                    key={col}
                    className={`px-5 py-3 font-barlow-condensed text-[10px] font-700 uppercase tracking-[3px] text-[#666] ${
                      col === "Points" ? "text-right" : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {ranked.map((team) => {
                const isUser = team.team_id === userTeamId;
                const rankClass =
                  team.displayRank === 1 ? "text-[#e8fb25]" : "text-[#f0f0f0]";
                return (
                  <tr
                    key={team.team_id}
                    className={`text-sm transition-colors hover:bg-[#1d1d26] ${
                      isUser ? "bg-[rgba(232,251,37,0.05)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span
                        className={`font-bebas text-xl tracking-[2px] ${rankClass}`}
                      >
                        {team.displayRank}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#f0f0f0]">
                      {team.team_name}
                      {isUser && (
                        <span className="ml-2 section-label text-[#c8d85a]">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[#555560]">
                      {team.owner_name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
                        {Math.round(Number(team.points))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
