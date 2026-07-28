"use client";

import { useMemo } from "react";
import { Crown, Users } from "lucide-react";

import {
  PositionContributionCard,
  type PositionContribution,
} from "@/components/shared/scoring";
import type { MyTeamPlayerView } from "../types";

// Gameweek summary for a fantasy team (Task 6): total points (captain doubled),
// captain multiplier + points, vice-captain, bench points, and a points-by-
// position chart. Reads the already-assembled MyTeamPlayerView list, so it's
// sport-agnostic (positions come straight from the data).
export function TeamSummaryCard({ players }: { players: MyTeamPlayerView[] }) {
  const s = useMemo(() => {
    const starters = players.filter((p) => p.isStarter);
    const bench = players.filter((p) => !p.isStarter);
    const captain = players.find((p) => p.isCaptain) ?? null;
    const vice = players.find((p) => p.isViceCaptain) ?? null;

    const startersRaw = starters.reduce((a, p) => a + p.gameweekPoints, 0);
    const captainPts = captain?.gameweekPoints ?? 0;
    // Captain scores double, so add their points once more to the total.
    const total = startersRaw + captainPts;
    const benchPts = bench.reduce((a, p) => a + p.gameweekPoints, 0);

    // Points by position among starters, with the captain's points doubled in
    // their own position bucket.
    const byPos: Record<string, number> = {};
    for (const p of starters) {
      const pts = p.gameweekPoints * (p.isCaptain ? 2 : 1);
      byPos[p.position] = (byPos[p.position] ?? 0) + pts;
    }
    const contributions: PositionContribution[] = Object.entries(byPos)
      .map(([position, points]) => ({ position, points }))
      .sort((a, b) => b.points - a.points);

    return { total, captain, captainPts, vice, benchPts, contributions };
  }, [players]);

  return (
    <section className="card-surface animate-fade-soft p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-label">Gameweek Points</p>
          <p className="mt-1 font-display text-5xl tracking-[-0.02em] text-accent">
            {Math.round(s.total)}
          </p>
        </div>
        <div className="text-right text-xs text-fg-3">
          <p>
            Bench <span className="font-700 text-fg-2">{Math.round(s.benchPts)}</span>
          </p>
          {s.vice && (
            <p className="mt-1">
              VC <span className="font-600 text-fg-2">{s.vice.name}</span>
            </p>
          )}
        </div>
      </div>

      {s.captain && (
        <div className="mt-4 flex items-center gap-2 rounded-[3px] border border-accent/25 bg-accent/8 px-3 py-2">
          <Crown className="size-4 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-fg-1">
            <span className="font-600">{s.captain.name}</span>
            <span className="ml-1.5 rounded-[2px] bg-accent px-1 text-[10px] font-700 text-surface-0">
              ×2
            </span>
          </span>
          <span className="shrink-0 font-700 tabular-nums text-accent">
            +{Math.round(s.captainPts * 2)}
          </span>
        </div>
      )}

      {s.contributions.length > 0 && (
        <PositionContributionCard
          contributions={s.contributions}
          className="mt-4 !border-white/6 !bg-transparent !p-0"
        />
      )}

      {s.contributions.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-fg-3">
          <Users className="size-4" aria-hidden />
          Points appear here once your gameweek is scored.
        </p>
      )}
    </section>
  );
}
