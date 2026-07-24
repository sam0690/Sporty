"use client";

import { useMemo } from "react";

import type { TCompetitionMatch } from "@/types/competition";

// Knockout rounds in progression order (new UCL format has a Play-offs round).
const STAGES: { key: string; label: string }[] = [
  { key: "PLAYOFFS", label: "Play-offs" },
  { key: "LAST_16", label: "Round of 16" },
  { key: "QUARTER_FINALS", label: "Quarter-finals" },
  { key: "SEMI_FINALS", label: "Semi-finals" },
  { key: "FINAL", label: "Final" },
];
const KNOCKOUT = new Set(STAGES.map((s) => s.key));

export function hasKnockout(matches: TCompetitionMatch[]): boolean {
  return matches.some((m) => m.stage && KNOCKOUT.has(m.stage));
}

type Side = { id: number; name: string; crest?: string | null; goals: number };
type Tie = { sides: [Side, Side]; played: boolean; winnerId: number | null; date: string };

// Fold a stage's legs into ties (two-legged except the final), aggregating
// goals across both legs. A tie level with an equal aggregate is left with no
// winner highlighted (penalties/away-goals aren't in the free feed).
function tiesForStage(matches: TCompetitionMatch[], stage: string): Tie[] {
  const legs = matches.filter((m) => m.stage === stage);
  const byPair = new Map<string, TCompetitionMatch[]>();
  for (const m of legs) {
    const key = [m.homeTeam.id, m.awayTeam.id].sort((a, b) => a - b).join("-");
    (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(m);
  }

  const ties: Tie[] = [];
  for (const group of byPair.values()) {
    const agg = new Map<number, Side>();
    let played = false;
    let earliest = group[0].utcDate;
    for (const leg of group) {
      const h = leg.score?.fullTime?.home;
      const a = leg.score?.fullTime?.away;
      if (h != null && a != null) played = true;
      if (leg.utcDate < earliest) earliest = leg.utcDate;
      for (const [team, g] of [
        [leg.homeTeam, h] as const,
        [leg.awayTeam, a] as const,
      ]) {
        const prev = agg.get(team.id);
        agg.set(team.id, {
          id: team.id,
          name: team.name,
          crest: team.crest,
          goals: (prev?.goals ?? 0) + (g ?? 0),
        });
      }
    }
    const sides = [...agg.values()].slice(0, 2) as [Side, Side];
    if (sides.length < 2) continue;
    let winnerId: number | null = null;
    if (played && sides[0].goals !== sides[1].goals) {
      winnerId = (sides[0].goals > sides[1].goals ? sides[0] : sides[1]).id;
    }
    ties.push({ sides, played, winnerId, date: earliest });
  }
  ties.sort((a, b) => a.date.localeCompare(b.date));
  return ties;
}

function TeamRow({ side, winner }: { side: Side; winner: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {side.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.crest} alt="" className="size-5 shrink-0 object-contain" loading="lazy" />
      ) : (
        <span className="size-5 shrink-0 rounded-full bg-surface-3" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          winner ? "font-700 text-fg-1" : "font-500 text-fg-2"
        }`}
      >
        {side.name}
      </span>
      <span className={`tabular-nums text-sm ${winner ? "font-700 text-accent" : "text-fg-3"}`}>
        {side.goals}
      </span>
    </div>
  );
}

export function KnockoutBracket({ matches }: { matches: TCompetitionMatch[] }) {
  const columns = useMemo(
    () =>
      STAGES.map((s) => ({ ...s, ties: tiesForStage(matches, s.key) })).filter(
        (c) => c.ties.length > 0,
      ),
    [matches],
  );

  if (columns.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center text-sm text-fg-2">
        The knockout bracket appears once the league phase finishes.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {columns.map((col) => (
          <div key={col.key} className="w-64 shrink-0 space-y-3">
            <p className="section-label px-1">{col.label}</p>
            {col.ties.map((tie, i) => (
              <div key={i} className="overflow-hidden card-surface divide-y divide-white/6">
                <TeamRow side={tie.sides[0]} winner={tie.winnerId === tie.sides[0].id} />
                <TeamRow side={tie.sides[1]} winner={tie.winnerId === tie.sides[1].id} />
                {!tie.played && (
                  <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-fg-3">
                    {new Date(tie.date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
