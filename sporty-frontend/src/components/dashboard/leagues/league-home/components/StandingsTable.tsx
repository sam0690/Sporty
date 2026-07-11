"use client";

import type { TLeaderboardEntry } from "@/types/league";

type StandingsTableProps = {
  entries: TLeaderboardEntry[];
  userTeamId: string;
  isLoading?: boolean;
};

const MEDAL_STYLE: Record<number, string> = {
  1: "bg-[rgba(255,216,107,0.15)] text-[#ffd86b] border-[rgba(255,216,107,0.4)]",
  2: "bg-[rgba(200,208,220,0.12)] text-[#c8d0dc] border-[rgba(200,208,220,0.35)]",
  3: "bg-[rgba(205,127,50,0.15)] text-[#cd7f32] border-[rgba(205,127,50,0.4)]",
};

export function StandingsTable({
  entries,
  userTeamId,
  isLoading,
}: StandingsTableProps) {
  // Backend rank can be null until the ranking job runs; fall back to position
  // in points-sorted order so the list always shows a sensible standing.
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
              className="h-14 animate-pulse rounded-[3px] bg-[#1d1d26]"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="p-6 text-sm text-[#555560]">
          No standings yet — they appear once teams are scored for a gameweek.
        </div>
      ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {ranked.map((team) => {
            const isUser = team.team_id === userTeamId;
            const medalClass = MEDAL_STYLE[team.displayRank];

            return (
              <div
                key={team.team_id}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#1d1d26] ${
                  isUser
                    ? "border-l-2 border-[#e8fb25] bg-[rgba(232,251,37,0.05)]"
                    : "border-l-2 border-transparent"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border font-bebas text-lg tracking-[1px] ${
                    medalClass ?? "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5]"
                  }`}
                >
                  {team.displayRank}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                    {team.team_name}
                    {isUser && (
                      <span className="ml-2 section-label text-[#c8d85a]">You</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#555560]">
                    {team.owner_name}
                  </p>
                </div>

                <span className="num shrink-0 font-bebas text-2xl tracking-[1px] text-[#e8fb25]">
                  {Math.round(Number(team.points))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
