"use client";

import { useMemo } from "react";

import type { MatchRatings } from "@/types/events";

type RatingsCardProps = {
  ratings: MatchRatings | null;
};

export function RatingsCard({ ratings }: RatingsCardProps) {
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
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Player Ratings
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#555560]">
        {rows.map((row, index) => {
          const isMotm =
            row.sporty_player_id !== null &&
            row.sporty_player_id === ratings.man_of_match_sporty_player_id;
          return (
            <li
              key={row.sporty_player_id ?? `unmapped-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="truncate">
                {row.name ?? row.sporty_player_id ?? "Unknown player"}
                {isMotm && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-[#e8fb25]">
                    MOTM
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs">
                {row.goals > 0 && `${row.goals}G `}
                {row.assists > 0 && `${row.assists}A`}
              </span>
              <span className="font-600 text-[#f0f0f0]">
                {row.rating.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
