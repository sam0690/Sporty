"use client";

import { useMemo } from "react";

import type { MatchRatings } from "@/types/events";

function ratingColor(rating: number): string {
  if (rating >= 8) return "#e8fb25";
  if (rating >= 6.5) return "#f0f0f0";
  return "#777783";
}

export function RatingsCard({ ratings }: { ratings: MatchRatings | null }) {
  const rows = useMemo(
    () =>
      ratings
        ? [...ratings.ratings].sort((a, b) => b.rating - a.rating).slice(0, 10)
        : [],
    [ratings],
  );

  if (!ratings || rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Player Ratings</span>

      <ul className="mt-3 space-y-1">
        {rows.map((row, index) => {
          const isMotm =
            row.sporty_player_id !== null &&
            row.sporty_player_id === ratings.man_of_match_sporty_player_id;
          return (
            <li
              key={row.sporty_player_id ?? `unmapped-${index}`}
              className="flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                    {row.name ?? row.sporty_player_id ?? "Unknown player"}
                  </span>
                  {isMotm && (
                    <span className="shrink-0 rounded-[3px] bg-[#e8fb25]/15 px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25]">
                      MOTM
                    </span>
                  )}
                </div>
                {(row.goals > 0 || row.assists > 0) && (
                  <div className="mt-0.5 text-xs text-[#555560]">
                    {row.goals > 0 && `${row.goals} goal${row.goals > 1 ? "s" : ""}`}
                    {row.goals > 0 && row.assists > 0 && " · "}
                    {row.assists > 0 &&
                      `${row.assists} assist${row.assists > 1 ? "s" : ""}`}
                  </div>
                )}
              </div>
              <span
                className="shrink-0 font-bebas text-xl leading-none tracking-[1px]"
                style={{ color: ratingColor(row.rating) }}
              >
                {row.rating.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
