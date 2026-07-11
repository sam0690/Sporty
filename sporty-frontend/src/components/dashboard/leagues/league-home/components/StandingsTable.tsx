"use client";

import type { TLeaderboardEntry } from "@/types/league";

type StandingsTableProps = {
  entries: TLeaderboardEntry[];
  userTeamId: string;
  isLoading?: boolean;
};

const MEDAL_STYLE: Record<number, string> = {
  1: "bg-warning/15 text-warning border-warning/40",
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
    <section className="overflow-hidden card-surface animate-fade-soft">
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="font-sans text-xs font-700 uppercase tracking-[3px] text-[#666]">
          Standings
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[3px] bg-surface-3"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="p-6 text-sm text-fg-3">
          No standings yet — they appear once teams are scored for a gameweek.
        </div>
      ) : (
        <div className="divide-y divide-white/6">
          {ranked.map((team) => {
            const isUser = team.team_id === userTeamId;
            const medalClass = MEDAL_STYLE[team.displayRank];

            return (
              <div
                key={team.team_id}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-3 ${
                  isUser
                    ? "border-l-2 border-accent bg-accent/5"
                    : "border-l-2 border-transparent"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border font-display text-lg tracking-[-0.02em] ${
                    medalClass ?? "border-white/8 bg-surface-3 text-fg-2"
                  }`}
                >
                  {team.displayRank}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                    {team.team_name}
                    {isUser && (
                      <span className="ml-2 section-label text-accent-dim">You</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-fg-3">
                    {team.owner_name}
                  </p>
                </div>

                <span className="num shrink-0 font-display text-2xl tracking-[-0.02em] text-accent">
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
