"use client";

import { memo } from "react";

type FantasyPointsBadgeProps = {
  points: number;
  size?: "sm" | "md" | "lg";
  /** Highlight (e.g. just changed) — animated ring pulse. */
  live?: boolean;
  className?: string;
};

const SIZES = {
  sm: "px-1.5 py-0.5 text-[11px] min-w-[28px]",
  md: "px-2 py-0.5 text-sm min-w-[34px]",
  lg: "px-3 py-1 font-display text-2xl tracking-[-0.02em] min-w-[52px]",
};

// The canonical "N pts" pill. Gold-on-ink, sport-agnostic. `live` adds a brief
// highlight ring used when a score changes mid-match.
function FantasyPointsBadgeBase({
  points,
  size = "md",
  live = false,
  className = "",
}: FantasyPointsBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[3px] border border-accent/25 bg-accent/10 font-700 tabular-nums text-accent transition-[box-shadow,background-color] duration-300 ${
        SIZES[size]
      } ${live ? "ring-2 ring-accent/60 bg-accent/20 motion-reduce:ring-0" : ""} ${className}`}
      aria-label={`${Math.round(points * 100) / 100} fantasy points`}
    >
      {Math.round(points * 100) / 100}
    </span>
  );
}

export const FantasyPointsBadge = memo(FantasyPointsBadgeBase);
