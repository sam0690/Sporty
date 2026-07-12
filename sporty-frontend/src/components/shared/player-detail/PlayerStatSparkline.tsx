"use client";

import type { TPlayerGameweekStat } from "@/types";

type PlayerStatSparklineProps = {
  /** Newest-first, as returned by usePlayerRecentStats. */
  stats: TPlayerGameweekStat[];
};

const WIDTH = 280;
const HEIGHT = 56;
const PADDING = 6;

export function PlayerStatSparkline({ stats }: PlayerStatSparklineProps) {
  if (stats.length < 2) {
    return null;
  }

  const chronological = [...stats].reverse();
  const values = chronological.map((s) => s.fantasy_points);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const points = chronological.map((s, i) => ({
    x: PADDING + (i / (chronological.length - 1)) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((s.fantasy_points - min) / range) * (HEIGHT - PADDING * 2),
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = chronological[0];
  const lastStat = chronological[chronological.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="micro-label text-fg-3">Form (fantasy pts)</span>
        <span className="text-xs text-fg-2">
          GW{first.transfer_window.number}&ndash;GW{lastStat.transfer_window.number}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-14 w-full"
        role="img"
        aria-label={`Fantasy points trend from gameweek ${first.transfer_window.number} to gameweek ${lastStat.transfer_window.number}, most recent ${lastStat.fantasy_points} points`}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={3.5} fill="var(--accent)" />
      </svg>
    </div>
  );
}
