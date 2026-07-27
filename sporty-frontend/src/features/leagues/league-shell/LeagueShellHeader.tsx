"use client";

import { Badge } from "@/components/ui";
import type { TSeasonState } from "@/types/league";
import { formatDateTime } from "@/utils/dateUtils";

type Sport = "football" | "basketball";

type LeagueShellHeaderProps = {
  leagueName: string;
  sport: Sport;
  isDraftMode: boolean;
  seasonState?: TSeasonState;
};

const sportGlow: Record<Sport, string> = {
  football: "#00ff88",
  basketball: "#ff6b35",
};

// The right-hand status block, driven entirely by the season phase — no more
// falling back to a fake "GW 1/16" when nothing is live yet (pre-season).
function StatusBlock({ state }: { state?: TSeasonState }) {
  if (!state) return null;

  if (state.phase === "PRE_SEASON") {
    return (
      <div className="min-w-[240px] shrink-0">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">Pre-season</span>
          <Badge tone="neutral" size="sm">
            Building squads
          </Badge>
        </div>
        {state.first_deadline_at ? (
          <p className="mt-2 text-sm text-fg-3">
            No matches yet — first deadline{" "}
            <span className="font-600 text-fg-1">
              {formatDateTime(state.first_deadline_at)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-fg-3">
            Season fixtures not scheduled yet.
          </p>
        )}
      </div>
    );
  }

  const total = state.total_gw || 0;
  const label = state.phase === "COMPLETED" ? "Final Standings" : "Season Progress";
  const shown = state.phase === "COMPLETED" ? total : state.current_gw;
  const pct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((shown / total) * 100))) : 0;

  return (
    <div className="min-w-[220px] shrink-0">
      <div className="flex items-center justify-between gap-3">
        <span className="section-label">{label}</span>
        <span className="font-display text-xl tracking-[-0.02em] text-accent">
          GW {shown}
          <span className="text-fg-3">/{total}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LeagueShellHeader({
  leagueName,
  sport,
  isDraftMode,
  seasonState,
}: LeagueShellHeaderProps) {
  const glow = sportGlow[sport];

  return (
    <header
      className="relative mb-5 overflow-hidden rounded-[3px] border border-white/8 p-6 sm:p-8"
      style={{ background: `linear-gradient(135deg, ${glow}14 0%, #0d0d12 60%)` }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `${glow}22` }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge sport={sport} size="sm">
              {sport}
            </Badge>
            <Badge tone="neutral" size="sm">
              {isDraftMode ? "Draft" : "Budget"}
            </Badge>
          </div>
          <h1 className="mt-3 truncate font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-7xl">
            {leagueName}
          </h1>
        </div>

        <StatusBlock state={seasonState} />
      </div>
    </header>
  );
}

export type { Sport };
