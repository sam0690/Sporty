"use client";

import { memo } from "react";
import { Check } from "lucide-react";

import type { TScoreEvent } from "@/types/player";
import {
  formatSignedPoints,
  pointsTone,
  scoreActionLabel,
  TONE_TEXT,
} from "./scoringFormat";

type ScoreEventListProps = {
  events: TScoreEvent[];
  /** Dense variant for popovers/cards. */
  compact?: boolean;
  className?: string;
};

// Generic renderer for a breakdown: one row per scored action, colour-coded
// (green positive / red negative / gold bonus). Works for any sport — the
// action label falls back to a humanized key.
function ScoreEventListBase({ events, compact = false, className = "" }: ScoreEventListProps) {
  if (!events || events.length === 0) {
    return (
      <p className={`text-sm text-fg-3 ${className}`}>No scoring events yet.</p>
    );
  }
  return (
    <ul className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"} ${className}`}>
      {events.map((e, i) => {
        const tone = pointsTone(e.subtotal, e.action);
        const showCount = typeof e.count === "number" && e.count > 1;
        return (
          <li
            key={`${e.action}-${e.match_id ?? i}`}
            className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}
          >
            <Check
              className={`size-3.5 shrink-0 ${tone === "negative" ? "text-danger/60" : "text-[#34d399]/70"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-fg-2">
              {scoreActionLabel(e.action)}
              {showCount && <span className="text-fg-3"> ×{e.count}</span>}
            </span>
            <span className="mx-1 hidden flex-1 border-b border-dotted border-white/10 sm:block" aria-hidden />
            <span className={`shrink-0 font-700 tabular-nums ${TONE_TEXT[tone]}`}>
              {formatSignedPoints(e.subtotal)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const ScoreEventList = memo(ScoreEventListBase);
