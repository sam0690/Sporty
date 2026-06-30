"use client";

import { useMemo } from "react";

import type { MatchRatings } from "@/types/events";

type RatingsCardProps = {
  ratings: MatchRatings | null;
};

function ratingTone(rating: number): string {
  if (rating >= 8) return "bg-football/15 text-football border-football/30";
  if (rating >= 6.5) return "bg-gold/15 text-gold border-gold/30";
  return "bg-white/5 text-muted-foreground border-border";
}

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
    <section className="glass rounded-xl p-5">
      <span className="section-label">Player Ratings</span>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row, index) => {
          const isMotm =
            row.sporty_player_id !== null &&
            row.sporty_player_id === ratings.man_of_match_sporty_player_id;
          return (
            <li
              key={row.sporty_player_id ?? `unmapped-${index}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-600 text-foreground">
                    {row.name ?? row.sporty_player_id ?? "Unknown player"}
                  </span>
                  {isMotm && (
                    <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-700 uppercase tracking-wider text-gold">
                      MOTM
                    </span>
                  )}
                </div>
                {(row.goals > 0 || row.assists > 0) && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {row.goals > 0 && `${row.goals} goal${row.goals > 1 ? "s" : ""}`}
                    {row.goals > 0 && row.assists > 0 && " · "}
                    {row.assists > 0 &&
                      `${row.assists} assist${row.assists > 1 ? "s" : ""}`}
                  </div>
                )}
              </div>
              <span
                className={`grid h-8 w-11 shrink-0 place-items-center rounded-md border text-sm font-700 tabular-nums ${ratingTone(
                  row.rating,
                )}`}
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
