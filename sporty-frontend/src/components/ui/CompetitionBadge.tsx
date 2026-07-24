"use client";

import { competitionMeta } from "@/lib/footballCompetitions";

type CompetitionBadgeProps = {
  /** Stored tag: "EPL" | "LALIGA" | "BUNDESLIGA". Null/absent renders nothing
   * (unscoped pool — no badge needed). */
  tag: string | null | undefined;
  className?: string;
};

/** Small pill naming the competition a football pool is scoped to. Renders
 * nothing when the pool spans all competitions, so callers can drop it in
 * unconditionally. */
export function CompetitionBadge({ tag, className = "" }: CompetitionBadgeProps) {
  // "ALL"/null means an unscoped pool — no badge. competitionMeta only
  // resolves real competition tags, so a null meta covers both.
  const meta = tag && tag !== "ALL" ? competitionMeta(tag) : null;
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-surface-2 px-2.5 py-1 font-sans text-[11px] font-700 uppercase tracking-[0.5px] text-fg-2 ${className}`}
    >
      <span className="text-xs leading-none" aria-hidden="true">
        {meta.flag}
      </span>
      {meta.label}
    </span>
  );
}
