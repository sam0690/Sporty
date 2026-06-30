"use client";

import { useMemo } from "react";

import type { MatchRatings, PlayerRating } from "@/types/events";

function ratingColor(rating: number): string {
  if (rating >= 8) return "#e8fb25";
  if (rating >= 7) return "#4caf50";
  if (rating >= 6) return "#ffd86b";
  return "#9a9aa5";
}

function RatingRow({
  row,
  isMotm,
}: {
  row: PlayerRating;
  isMotm: boolean;
}) {
  const color = ratingColor(row.rating);
  const pct = Math.max(6, Math.min(100, (row.rating / 10) * 100));
  return (
    <div
      className={`rounded-[3px] border bg-[#0d0d12] px-3 py-2.5 transition-colors ${
        isMotm
          ? "border-[rgba(232,251,37,0.35)]"
          : "border-[rgba(255,255,255,0.08)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
              {row.name ?? row.sporty_player_id ?? "Unknown"}
            </span>
            {isMotm && (
              <span className="shrink-0 rounded-[3px] bg-[rgba(232,251,37,0.15)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25]">
                MOTM
              </span>
            )}
          </div>
          {(row.goals > 0 || row.assists > 0) && (
            <p className="mt-0.5 flex gap-2 text-[10px] font-700 uppercase tracking-[1px]">
              {row.goals > 0 && (
                <span className="text-[#4caf50]">{row.goals}G</span>
              )}
              {row.assists > 0 && (
                <span className="text-[#00d4ff]">{row.assists}A</span>
              )}
            </p>
          )}
        </div>
        <span
          className="shrink-0 font-bebas text-2xl leading-none tracking-[1px]"
          style={{ color }}
        >
          {row.rating.toFixed(1)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1d1d26]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function RatingsCard({ ratings }: { ratings: MatchRatings | null }) {
  const rows = useMemo(
    () =>
      ratings
        ? [...ratings.ratings].sort((a, b) => b.rating - a.rating).slice(0, 16)
        : [],
    [ratings],
  );

  if (!ratings || rows.length === 0) {
    return null;
  }

  const motmId = ratings.man_of_match_sporty_player_id;

  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <span className="section-label">Player Ratings</span>
        {ratings.man_of_match_name && (
          <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
            MOTM <span className="text-[#e8fb25]">{ratings.man_of_match_name}</span>
          </span>
        )}
      </header>
      <div className="grid gap-2 p-5 sm:grid-cols-2">
        {rows.map((row, index) => (
          <RatingRow
            key={row.sporty_player_id ?? `r-${index}`}
            row={row}
            isMotm={row.sporty_player_id !== null && row.sporty_player_id === motmId}
          />
        ))}
      </div>
    </section>
  );
}
