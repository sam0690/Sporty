"use client";

import { Sparkles } from "lucide-react";

// Gold bonus chip. Renders nothing when there's no bonus so callers can drop it
// in unconditionally.
export function BonusPointsChip({ bonus, className = "" }: { bonus: number; className?: string }) {
  if (!bonus) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11px] font-700 tabular-nums text-accent ${className}`}
      title="Bonus points"
    >
      <Sparkles className="size-3" aria-hidden />
      +{Math.round(bonus * 100) / 100}
    </span>
  );
}
