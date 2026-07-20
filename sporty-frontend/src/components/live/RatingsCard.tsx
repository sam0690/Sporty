"use client";

import { useMemo } from "react";

import type { MatchRatings, PlayerRating } from "@/types/events";
import { Panel } from "./Panel";
import { StarIcon, TrophyIcon } from "./icons";

function ratingColor(rating: number): string {
  if (rating >= 8) return "#00e07f"; // success green — standout
  if (rating >= 7) return "#e2c368"; // accent gold — strong
  if (rating >= 6) return "#ffd86b"; // soft amber — solid
  return "#a0a0aa"; // fg-2 — quiet
}

function countMatching(events: string[], needle: string): number {
  return events.reduce((n, e) => (e.includes(needle) ? n + 1 : n), 0);
}

const CHIP_TONES = {
  goal: "text-success bg-success/12",
  assist: "text-info bg-info/12",
  red: "text-danger bg-danger/14",
  yellow: "text-[#e0b93a] bg-[#e0b93a]/14",
} as const;

function StatChip({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof CHIP_TONES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-0.5 font-sans text-[10px] font-700 uppercase leading-none tracking-[0.5px] ${CHIP_TONES[tone]}`}
    >
      {label}
    </span>
  );
}

function RatingRow({
  row,
  rank,
  isMotm,
}: {
  row: PlayerRating;
  rank: number;
  isMotm: boolean;
}) {
  const color = ratingColor(row.rating);
  const pct = Math.max(4, Math.min(100, (row.rating / 10) * 100));
  const yellows = countMatching(row.events, "yellow");
  const reds = countMatching(row.events, "red");

  return (
    <li
      className={`group flex items-center gap-3 rounded-[4px] px-2.5 py-2 transition-colors duration-150 ${
        isMotm ? "bg-accent/[0.07]" : "hover:bg-surface-2"
      }`}
    >
      <span className="w-5 shrink-0 text-right font-sans text-xs font-700 tabular-nums text-fg-3">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-sans text-sm font-600 text-fg-1">
            {row.name ?? "Unknown"}
          </span>
          {isMotm && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-accent/16 px-1.5 py-0.5 font-sans text-[10px] font-700 uppercase leading-none tracking-[0.5px] text-accent">
              <StarIcon className="size-2.5" />
              MOTM
            </span>
          )}
          {row.goals > 0 && <StatChip label={`${row.goals} G`} tone="goal" />}
          {row.assists > 0 && <StatChip label={`${row.assists} A`} tone="assist" />}
          {reds > 0 && <StatChip label="RED" tone="red" />}
          {reds === 0 && yellows > 0 && (
            <StatChip label={yellows > 1 ? `${yellows} YEL` : "YEL"} tone="yellow" />
          )}
        </div>

        {/* Rating meter — length ∝ rating, so the column reads as a ranked
            bar chart down the list. */}
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%`, background: color }}
            />
          </span>
          <span className="shrink-0 font-sans text-[11px] font-600 tabular-nums text-fg-3">
            {row.minutes_played}&apos;
          </span>
        </div>
      </div>

      <span
        className="grid size-10 shrink-0 place-items-center rounded-[4px] font-display text-xl leading-none tracking-[-0.02em] tabular-nums"
        style={{
          color,
          background: `${color}14`,
          border: `1px solid ${color}3d`,
        }}
      >
        {row.rating.toFixed(1)}
      </span>
    </li>
  );
}

export function RatingsCard({ ratings }: { ratings: MatchRatings | null }) {
  const rows = useMemo(
    () =>
      ratings
        ? [...ratings.ratings].sort(
            (a, b) => b.rating - a.rating || (a.name ?? "").localeCompare(b.name ?? ""),
          )
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
      bodyClassName="p-2 sm:p-2.5"
      action={
        <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
          {ratings.man_of_match_name ? (
            <>
              MOTM <span className="text-accent">{ratings.man_of_match_name}</span>
            </>
          ) : (
            <>{rows.length} rated</>
          )}
        </span>
      }
    >
      <ol className="flex flex-col divide-y divide-white/[0.05]">
        {rows.map((row, index) => (
          <RatingRow
            key={row.sporty_player_id ?? `r-${index}`}
            row={row}
            rank={index + 1}
            isMotm={row.sporty_player_id !== null && row.sporty_player_id === motmId}
          />
        ))}
      </ol>
    </Panel>
  );
}
