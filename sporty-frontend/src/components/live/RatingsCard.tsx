"use client";

import { useMemo } from "react";

import type { MatchRatings, PlayerRating } from "@/types/events";
import { Panel } from "./Panel";
import { StarIcon, TrophyIcon } from "./icons";

function ratingColor(rating: number): string {
  if (rating >= 8) return "#00ff88";
  if (rating >= 7) return "#e8fb25";
  if (rating >= 6) return "#ffd86b";
  return "#9a9aa5";
}

function RatingRow({
  row,
  isMotm,
  index,
}: {
  row: PlayerRating;
  isMotm: boolean;
  index: number;
}) {
  const color = ratingColor(row.rating);
  const pct = Math.max(6, Math.min(100, (row.rating / 10) * 100));
  return (
    <div
      className={`pop-in relative overflow-hidden rounded-[3px] border px-3.5 py-3 transition-colors ${
        isMotm
          ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.05)]"
          : "border-[rgba(255,255,255,0.08)] bg-[#0d0d12] hover:border-[rgba(255,255,255,0.16)]"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
              {row.name ?? row.sporty_player_id ?? "Unknown"}
            </span>
            {isMotm && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-[rgba(232,251,37,0.16)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25]">
                <StarIcon className="size-2.5" />
                MOTM
              </span>
            )}
          </div>
          {(row.goals > 0 || row.assists > 0) && (
            <p className="mt-1 flex gap-2 text-[10px] font-700 uppercase tracking-[1px]">
              {row.goals > 0 && <span className="text-[#00ff88]">{row.goals}G</span>}
              {row.assists > 0 && (
                <span className="text-[#00d4ff]">{row.assists}A</span>
              )}
            </p>
          )}
        </div>
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[3px] font-bebas text-2xl leading-none tracking-[1px]"
          style={{ color, background: `${color}14`, border: `1px solid ${color}3d` }}
        >
          {row.rating.toFixed(1)}
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#1d1d26]">
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
    <Panel
      title="Player Ratings"
      icon={<TrophyIcon className="size-3.5" />}
      action={
        ratings.man_of_match_name ? (
          <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
            MOTM{" "}
            <span className="text-[#e8fb25]">{ratings.man_of_match_name}</span>
          </span>
        ) : null
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row, index) => (
          <RatingRow
            key={row.sporty_player_id ?? `r-${index}`}
            row={row}
            index={index}
            isMotm={
              row.sporty_player_id !== null && row.sporty_player_id === motmId
            }
          />
        ))}
      </div>
    </Panel>
  );
}
