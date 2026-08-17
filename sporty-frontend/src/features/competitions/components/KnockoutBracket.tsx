"use client";

import { useMemo } from "react";

import type { TCompetitionMatch } from "@/types/competition";

// Rounds that form the converging bracket (outermost -> innermost), excluding
// the final (centre) and the play-offs (shown separately, since their winners
// feed the round of 16 rather than nesting cleanly).
const BRACKET_ROUNDS = ["LAST_16", "QUARTER_FINALS", "SEMI_FINALS"] as const;
const KNOCKOUT = new Set(["PLAYOFFS", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]);
const LABEL: Record<string, string> = {
  PLAYOFFS: "Play-offs",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
};

export function hasKnockout(matches: TCompetitionMatch[]): boolean {
  return matches.some((m) => m.stage && KNOCKOUT.has(m.stage));
}

// Ids are identity only here — never arithmetic — and competition team ids
// are numeric for football but string for sports we compute ourselves, so
// everything keys on the stringified id.
type Side = { id: string; name: string; crest?: string | null; goals: number };
type Tie = { sides: [Side, Side]; played: boolean; winnerId: string | null; date: string };

// Fold a stage's legs into ties (two-legged except the final), aggregating
// goals. Equal aggregate = no winner highlighted (pens/away goals absent).
function tiesForStage(matches: TCompetitionMatch[], stage: string): Tie[] {
  const legs = matches.filter((m) => m.stage === stage);
  const byPair = new Map<string, TCompetitionMatch[]>();
  for (const m of legs) {
    const key = [m.homeTeam.id, m.awayTeam.id].map(String).sort().join("-");
    (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(m);
  }
  const ties: Tie[] = [];
  for (const group of byPair.values()) {
    const agg = new Map<string, Side>();
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
        const teamId = String(team.id);
        const prev = agg.get(teamId);
        agg.set(teamId, {
          id: teamId,
          name: team.name,
          crest: team.crest,
          goals: (prev?.goals ?? 0) + (g ?? 0),
        });
      }
    }
    const sides = [...agg.values()].slice(0, 2) as [Side, Side];
    if (sides.length < 2) continue;
    let winnerId: string | null = null;
    if (played && sides[0].goals !== sides[1].goals) {
      winnerId = (sides[0].goals > sides[1].goals ? sides[0] : sides[1]).id;
    }
    ties.push({ sides, played, winnerId, date: earliest });
  }
  ties.sort((a, b) => a.date.localeCompare(b.date));
  return ties;
}

function TeamRow({
  side,
  winner,
  dim,
  played,
}: {
  side: Side;
  winner: boolean;
  dim: boolean;
  played: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      {side.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.crest} alt="" className="size-4 shrink-0 object-contain" loading="lazy" />
      ) : (
        <span className="size-4 shrink-0 rounded-full bg-surface-3" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          winner ? "font-700 text-fg-1" : dim ? "font-500 text-fg-3" : "font-500 text-fg-2"
        }`}
      >
        {side.name}
      </span>
      <span className={`tabular-nums text-xs ${winner ? "font-700 text-accent" : "text-fg-3"}`}>
        {played ? side.goals : ""}
      </span>
    </div>
  );
}

function TieCard({ tie, emphasized = false }: { tie: Tie; emphasized?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-[4px] border divide-y divide-white/6 ${
        emphasized ? "border-accent/40 bg-accent/5" : "border-white/8 bg-surface-2"
      }`}
    >
      <TeamRow
        side={tie.sides[0]}
        winner={tie.winnerId === tie.sides[0].id}
        dim={tie.winnerId != null && tie.winnerId !== tie.sides[0].id}
        played={tie.played}
      />
      <TeamRow
        side={tie.sides[1]}
        winner={tie.winnerId === tie.sides[1].id}
        dim={tie.winnerId != null && tie.winnerId !== tie.sides[1].id}
        played={tie.played}
      />
      {!tie.played && (
        <p className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-fg-3">
          {new Date(tie.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </p>
      )}
    </div>
  );
}

function RoundColumn({ label, ties }: { label: string; ties: Tie[] }) {
  return (
    <div className="flex w-52 shrink-0 flex-col">
      <p className="section-label mb-2 text-center">{label}</p>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {ties.map((tie, i) => (
          <TieCard key={i} tie={tie} />
        ))}
      </div>
    </div>
  );
}

export function KnockoutBracket({ matches }: { matches: TCompetitionMatch[] }) {
  const { columns, finalTie, playoffs } = useMemo(() => {
    const cols = BRACKET_ROUNDS.map((stage) => {
      const ties = tiesForStage(matches, stage);
      const half = Math.ceil(ties.length / 2);
      return { stage, left: ties.slice(0, half), right: ties.slice(half) };
    }).filter((c) => c.left.length + c.right.length > 0);
    const fin = tiesForStage(matches, "FINAL")[0] ?? null;
    return { columns: cols, finalTie: fin, playoffs: tiesForStage(matches, "PLAYOFFS") };
  }, [matches]);

  if (columns.length === 0 && !finalTie && playoffs.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center text-sm text-fg-2">
        The knockout bracket appears once the league phase finishes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {playoffs.length > 0 && (
        <div>
          <p className="section-label mb-3">Knockout play-offs</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {playoffs.map((tie, i) => (
              <TieCard key={i} tie={tie} />
            ))}
          </div>
        </div>
      )}

      {(columns.length > 0 || finalTie) && (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-stretch justify-center gap-3">
            {/* Left side: outermost -> innermost */}
            {columns.map((c) => (
              <RoundColumn key={`l-${c.stage}`} label={LABEL[c.stage]} ties={c.left} />
            ))}

            {/* Centre: the final */}
            {finalTie && (
              <div className="flex w-56 shrink-0 flex-col justify-center">
                <p className="section-label mb-2 text-center text-accent">Final</p>
                <TieCard tie={finalTie} emphasized />
              </div>
            )}

            {/* Right side: innermost -> outermost (mirrored) */}
            {[...columns].reverse().map((c) => (
              <RoundColumn key={`r-${c.stage}`} label={LABEL[c.stage]} ties={c.right} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
