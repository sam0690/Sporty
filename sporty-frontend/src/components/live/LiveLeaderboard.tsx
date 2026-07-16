"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import { Panel, PanelEmpty } from "./Panel";
import { TrophyIcon } from "./icons";

type Row = {
  playerId: string;
  name: string;
  points: number;
  goals: number;
  assists: number;
};

// Podium tints for the top three ranks; everyone else is neutral.
const MEDAL: Record<number, string> = {
  0: "#ffd86b", // gold
  1: "#c8ccd4", // silver
  2: "#d08a4e", // bronze
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

export function LiveLeaderboard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const players = useMatchStore((s) => s.players);
  const events = useMatchStore((s) => s.events);

  // Per-player goal/assist tallies from the event timeline, so the board is
  // meaningful even when fantasy points aren't flowing (e.g. no demo lineup).
  const rows = useMemo<Row[]>(() => {
    // Ids arrive in mixed case: feeder fantasy-point keys are UPPERCASE while
    // the resolved players map is keyed by canonical lowercase UUIDs. Normalize
    // everything to lowercase so names resolve and a single player isn't split
    // into two rows.
    const nameByLowerId: Record<string, string> = {};
    for (const [id, info] of Object.entries(players)) {
      if (info?.name) nameByLowerId[id.toLowerCase()] = info.name;
    }

    const contrib: Record<string, { goals: number; assists: number }> = {};
    for (const e of events) {
      if (!e.player_id) continue;
      const key = e.player_id.toLowerCase();
      // Events carry resolved names too — use them for ids the players map
      // doesn't know, instead of rendering "Unknown player" rows.
      if (e.player_name) nameByLowerId[key] ??= e.player_name;
      const c = (contrib[key] ??= { goals: 0, assists: 0 });
      if (e.type === "goal") c.goals += 1;
      else if (e.type === "assist") c.assists += 1;
    }

    const pointsByLowerId: Record<string, number> = {};
    for (const [id, pts] of Object.entries(playerPoints)) {
      pointsByLowerId[id.toLowerCase()] = pts;
    }

    const ids = new Set([
      ...Object.keys(pointsByLowerId),
      ...Object.keys(contrib),
    ]);
    return [...ids]
      // Nameless ids are unmapped feeder artefacts — a row reading "Unknown
      // player" tells the fan nothing, so leave them off the board.
      .filter((id) => nameByLowerId[id])
      .map<Row>((id) => ({
        playerId: id,
        name: nameByLowerId[id],
        points: pointsByLowerId[id] ?? 0,
        goals: contrib[id]?.goals ?? 0,
        assists: contrib[id]?.assists ?? 0,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goals * 2 + b.assists - (a.goals * 2 + a.assists),
      )
      .slice(0, 10);
  }, [playerPoints, players, events]);

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
            return (
              <li
                key={row.playerId}
                className="pop-in flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-white/4"
                style={{
                  animationDelay: `${idx * 40}ms`,
                  background: idx === 0 ? "rgba(255,216,107,0.05)" : undefined,
                }}
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
                  {(row.goals > 0 || row.assists > 0) && (
                    <p className="mt-0.5 flex gap-2 text-[10px] font-700 uppercase tracking-[1px]">
                      {row.goals > 0 && (
                        <span className="text-success">{row.goals}G</span>
                      )}
                      {row.assists > 0 && (
                        <span className="text-info">{row.assists}A</span>
                      )}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-display text-xl leading-none tracking-[-0.02em] tabular-nums text-accent">
                  {row.points.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
