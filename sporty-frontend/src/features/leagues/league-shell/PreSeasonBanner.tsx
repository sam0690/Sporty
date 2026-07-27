"use client";

import type { TSeasonState } from "@/types/league";
import { formatDateTime } from "@/utils/dateUtils";

// Shown only in PRE_SEASON: the season hasn't kicked off, so a 0 score / last
// place isn't a loss — it's the team-building phase. Makes that explicit so the
// dashboard's empty tiles don't read as "you're losing".
export function PreSeasonBanner({ state }: { state?: TSeasonState }) {
  if (!state || state.phase !== "PRE_SEASON") return null;

  return (
    <div className="mb-5 rounded-[3px] border border-accent/30 bg-accent/8 px-5 py-4">
      <p className="font-sans text-xs font-700 uppercase tracking-[2px] text-accent">
        Pre-season · Team building
      </p>
      <p className="mt-2 text-sm text-fg-2">
        The season hasn&apos;t kicked off yet — no real matches have been played,
        so no points are scored. Build and refine your squad while you can.
        {state.first_deadline_at ? (
          <>
            {" "}
            Your first lineup locks{" "}
            <span className="font-600 text-fg-1">
              {formatDateTime(state.first_deadline_at)}
            </span>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
