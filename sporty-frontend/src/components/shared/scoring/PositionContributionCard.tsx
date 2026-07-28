"use client";

import { memo } from "react";

type PositionContribution = { position: string; points: number };

// Horizontal bar chart of points contributed by position (GKP/DEF/MID/FWD) —
// the Fantasy Team Summary "position contribution" view (Task 6). Generic over
// the position set so other sports can pass their own.
function PositionContributionCardBase({
  contributions,
  className = "",
}: {
  contributions: PositionContribution[];
  className?: string;
}) {
  const max = Math.max(1, ...contributions.map((c) => Math.abs(c.points)));
  return (
    <section className={`rounded-[3px] border border-white/8 bg-surface-1 p-4 ${className}`}>
      <span className="section-label">Points by Position</span>
      <div className="mt-3 flex flex-col gap-2.5">
        {contributions.map((c) => (
          <div key={c.position} className="flex items-center gap-3">
            <span className="w-9 shrink-0 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
              {c.position}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${(Math.abs(c.points) / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-700 tabular-nums text-fg-1">
              {Math.round(c.points)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export const PositionContributionCard = memo(PositionContributionCardBase);
export type { PositionContribution };
