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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] animate-fade-soft">
      <div className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
        <h2 className="font-barlow-condensed text-xs font-bold uppercase tracking-[3px] text-[#666]">
          Standings
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-[3px] bg-[#F3F4F7]"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="p-6 text-sm text-[#6B7280]">
          No standings yet — they appear once teams are scored for a gameweek.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#F3F4F7]">
              <tr>
                {["Rank", "Team", "Manager", "Points"].map((col) => (
                  <th
                    key={col}
                    className={`px-5 py-3 font-barlow-condensed text-[10px] font-bold uppercase tracking-[3px] text-[#666] ${
                      col === "Points" ? "text-right" : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(11,18,32,0.05)]">
              {ranked.map((team) => {
                const isUser = team.team_id === userTeamId;
                const rankClass =
                  team.displayRank === 1 ? "text-[#DC2626]" : "text-[#0B1220]";
                return (
                  <tr
                    key={team.team_id}
                    className={`text-sm transition-colors hover:bg-[#F3F4F7] ${
                      isUser ? "bg-[rgba(220,38,38,0.05)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span
                        className={`font-bebas text-xl tracking-[2px] ${rankClass}`}
                      >
                        {team.displayRank}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#0B1220]">
                      {team.team_name}
                      {isUser && (
                        <span className="ml-2 section-label text-[#B91C1C]">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[#6B7280]">
                      {team.owner_name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bebas text-xl tracking-[1px] text-[#DC2626]">
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
