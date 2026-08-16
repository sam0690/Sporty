"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { useMatchStore } from "@/store/matchStore";
import {
  BonusPointsChip,
  LivePointsIndicator,
  ScoreEventList,
} from "@/components/shared/scoring";
import type { TScoreEvent } from "@/types/player";
import { Panel, PanelEmpty } from "./Panel";
import { TrophyIcon } from "./icons";

type Row = {
  playerId: string;
  name: string;
  points: number;
  goals: number;
  assists: number;
  position: string | null;
  rating: number | null;
  bonus: number;
  breakdown: TScoreEvent[];
  stats: Record<string, number | null>;
};

// The match stat line shown under a player's scoring breakdown, in display
// order. Deliberately excludes what the breakdown already itemises (goals,
// assists, cards, clean sheets) — this is the context those points came from,
// not a second copy of them. Minutes always show; the rest only when non-zero,
// so a centre-back's row isn't padded with "0 Saves".
const STAT_LINE: ReadonlyArray<[key: string, label: string]> = [
  ["minutes", "Mins"],
  ["shots_on_target", "Shots OT"],
  ["key_passes", "Key passes"],
  ["dribbles_won", "Dribbles"],
  ["duels_won", "Duels won"],
  ["tackles", "Tackles"],
  ["interceptions", "Intercept"],
  ["clearances", "Clearances"],
  ["blocks", "Blocks"],
  ["saves", "Saves"],
  ["goals_conceded", "Conceded"],
];

function statEntries(stats: Record<string, number | null>) {
  return STAT_LINE.filter(([key]) => {
    const value = stats[key];
    return typeof value === "number" && (value > 0 || key === "minutes");
  }).map(([key, label]) => [label, stats[key] as number] as const);
}

// Podium tints for the top three ranks; everyone else is neutral.
const MEDAL: Record<number, string> = {
  0: "#ffd86b",
  1: "#c8ccd4",
  2: "#d08a4e",
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Live match-centre "Top Performers": fantasy points animate as
// FANTASY_POINTS_DELTA arrives (LivePointsIndicator), and each row expands to
// the player's scoring breakdown (populated at full-time from the per-match
// scoring layer). Position/rating come from the same source; goals/assists
// fall back to the live event tally before FT.
export function LiveLeaderboard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const playerBreakdowns = useMatchStore((s) => s.playerBreakdowns);
  const players = useMatchStore((s) => s.players);
  const events = useMatchStore((s) => s.events);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    // Ids arrive mixed-case (uppercase feeder point keys vs lowercase UUIDs) —
    // normalize to lowercase so a player isn't split across rows.
    const nameByLowerId: Record<string, string> = {};
    for (const [id, info] of Object.entries(players)) {
      if (info?.name) nameByLowerId[id.toLowerCase()] = info.name;
    }

    const contrib: Record<string, { goals: number; assists: number }> = {};
    for (const e of events) {
      if (!e.player_id) continue;
      const key = e.player_id.toLowerCase();
      if (e.player_name) nameByLowerId[key] ??= e.player_name;
      const c = (contrib[key] ??= { goals: 0, assists: 0 });
      if (e.type === "goal") c.goals += 1;
      else if (e.type === "assist") c.assists += 1;
    }

    const pointsByLowerId: Record<string, number> = {};
    for (const [id, pts] of Object.entries(playerPoints)) {
      pointsByLowerId[id.toLowerCase()] = pts;
    }
    const bd = playerBreakdowns ?? {};
    const bdByLowerId: Record<string, (typeof bd)[string]> = {};
    for (const [id, v] of Object.entries(bd)) bdByLowerId[id.toLowerCase()] = v;

    const ids = new Set([
      ...Object.keys(pointsByLowerId),
      ...Object.keys(contrib),
      ...Object.keys(bdByLowerId),
    ]);
    return [...ids]
      .filter((id) => nameByLowerId[id])
      .map<Row>((id) => {
        const b = bdByLowerId[id];
        return {
          playerId: id,
          name: nameByLowerId[id],
          // Live running total wins; fall back to the booked score.
          points: pointsByLowerId[id] ?? b?.points ?? 0,
          goals: contrib[id]?.goals ?? 0,
          assists: contrib[id]?.assists ?? 0,
          position: b?.position ?? null,
          rating: b?.rating ?? null,
          bonus: b?.bonus ?? 0,
          breakdown: b?.breakdown ?? [],
          stats: b?.stats ?? {},
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goals * 2 + b.assists - (a.goals * 2 + a.assists),
      )
      .slice(0, 10);
  }, [playerPoints, playerBreakdowns, players, events]);

  return (
    <Panel title="Top Performers" icon={<TrophyIcon className="size-3.5" />}>
      {rows.length === 0 ? (
        <PanelEmpty
          icon={<TrophyIcon className="size-5" />}
          title="No player data yet"
          hint="Standout performers appear as points come in."
        />
      ) : (
        <ol className="space-y-1">
          {rows.map((row, idx) => {
            const medal = MEDAL[idx];
            const stats = statEntries(row.stats);
            const hasBreakdown = row.breakdown.length > 0 || stats.length > 0;
            const open = openId === row.playerId;
            return (
              <li key={row.playerId} className="pop-in" style={{ animationDelay: `${idx * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => hasBreakdown && setOpenId(open ? null : row.playerId)}
                  disabled={!hasBreakdown}
                  aria-expanded={hasBreakdown ? open : undefined}
                  className="flex w-full items-center gap-3 rounded-[3px] px-2 py-2 text-left transition-colors hover:bg-white/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
                  style={{ background: idx === 0 ? "rgba(255,216,107,0.05)" : undefined }}
                >
                  <span
                    className="w-5 shrink-0 text-center font-display text-lg leading-none tabular-nums"
                    style={{ color: medal ?? "#71717d" }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-[3px] font-sans text-[11px] font-700 tracking-[0.5px]"
                    style={{
                      color: medal ?? "#a0a0aa",
                      background: medal ? `${medal}1f` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${medal ? `${medal}59` : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {initialsOf(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                      {row.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] font-700 uppercase tracking-[1px]">
                      {row.position && <span className="text-fg-3">{row.position}</span>}
                      {row.rating != null && <span className="text-fg-3">{row.rating.toFixed(1)}★</span>}
                      {row.goals > 0 && <span className="text-success">{row.goals}G</span>}
                      {row.assists > 0 && <span className="text-info">{row.assists}A</span>}
                      <BonusPointsChip bonus={row.bonus} />
                    </p>
                  </div>
                  <LivePointsIndicator points={row.points} size="md" className="shrink-0 !text-accent" />
                  {hasBreakdown && (
                    <ChevronDown
                      className={`size-4 shrink-0 text-fg-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  )}
                </button>
                {open && hasBreakdown && (
                  <div className="mb-1 ml-10 mr-2 space-y-2 rounded-[3px] border border-white/6 bg-black/20 px-3 py-2">
                    {row.breakdown.length > 0 && (
                      <ScoreEventList events={row.breakdown} compact />
                    )}
                    {stats.length > 0 && (
                      <dl
                        className={`grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-4 ${
                          row.breakdown.length > 0 ? "border-t border-white/6 pt-2" : ""
                        }`}
                      >
                        {stats.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="truncate font-sans text-[9px] font-700 uppercase tracking-[1px] text-fg-3">
                              {label}
                            </dt>
                            <dd className="font-display text-sm leading-tight tabular-nums text-fg-1">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
