"use client";

import { useMemo } from "react";

import type { MatchRatings, PlayerRating } from "@/types/events";
import { Panel } from "./Panel";
import { StarIcon, TrophyIcon } from "./icons";

function ratingColor(rating: number): string {
  if (rating >= 8) return "#16A34A";
  if (rating >= 7) return "#DC2626";
  if (rating >= 6) return "#CA8A04";
  return "#6B7280";
}

function RatingRow({ row, isMotm }: { row: PlayerRating; isMotm: boolean }) {
  const color = ratingColor(row.rating);
  const pct = Math.max(6, Math.min(100, (row.rating / 10) * 100));
  return (
    <div
      className={`relative overflow-hidden rounded-[8px] border px-3.5 py-3 transition-colors ${
        isMotm
          ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.05)]"
          : "border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] hover:border-[rgba(11,18,32,0.16)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
              {row.name ?? row.sporty_player_id ?? "Unknown"}
            </span>
            {isMotm && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[rgba(220,38,38,0.16)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#DC2626]">
                <StarIcon className="size-2.5" />
                MOTM
              </span>
            )}
          </div>
          {(row.goals > 0 || row.assists > 0) && (
            <p className="mt-1 flex gap-2 text-[10px] font-bold uppercase tracking-[1px]">
              {row.goals > 0 && <span className="text-[#16A34A]">{row.goals}G</span>}
              {row.assists > 0 && (
                <span className="text-[#0891B2]">{row.assists}A</span>
              )}
            </p>
          )}
        </div>
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[7px] font-bebas text-2xl leading-none tracking-[1px]"
          style={{ color, background: `${color}14`, border: `1px solid ${color}3d` }}
        >
          {row.rating.toFixed(1)}
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#F3F4F7]">
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
          <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
            MOTM{" "}
            <span className="text-[#DC2626]">{ratings.man_of_match_name}</span>
          </span>
        ) : null
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row, index) => (
          <RatingRow
            key={row.sporty_player_id ?? `r-${index}`}
            row={row}
            isMotm={
              row.sporty_player_id !== null && row.sporty_player_id === motmId
            }
          />
        ))}
      </div>
    </Panel>
  );
}
