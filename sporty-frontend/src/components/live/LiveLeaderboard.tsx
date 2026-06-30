"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

type Row = {
  playerId: string;
  name: string;
  points: number;
  goals: number;
  assists: number;
};

export function LiveLeaderboard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const players = useMatchStore((s) => s.players);
  const events = useMatchStore((s) => s.events);

  // Per-player goal/assist tallies from the event timeline, so the board is
  // meaningful even when fantasy points aren't flowing (e.g. no demo lineup).
  const rows = useMemo<Row[]>(() => {
    const contrib: Record<string, { goals: number; assists: number }> = {};
    for (const e of events) {
      if (!e.player_id) continue;
      const c = (contrib[e.player_id] ??= { goals: 0, assists: 0 });
      if (e.type === "goal") c.goals += 1;
      else if (e.type === "assist") c.assists += 1;
    }

    const ids = new Set([...Object.keys(playerPoints), ...Object.keys(contrib)]);
    return [...ids]
      .map<Row>((id) => ({
        playerId: id,
        name: players[id]?.name ?? id,
        points: playerPoints[id] ?? 0,
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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Top Performers</span>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#555560]">No player data yet.</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {rows.map((row, idx) => (
            <li
              key={row.playerId}
              className="flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            >
              <span
                className={`w-5 shrink-0 text-center font-bebas text-base leading-none ${
                  idx === 0 ? "text-[#e8fb25]" : "text-[#555560]"
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                  {row.name}
                </p>
                {(row.goals > 0 || row.assists > 0) && (
                  <p className="mt-0.5 flex gap-2 text-[10px] font-700 uppercase tracking-[1px]">
                    {row.goals > 0 && (
                      <span className="text-[#4caf50]">{row.goals}G</span>
                    )}
                    {row.assists > 0 && (
                      <span className="text-[#00d4ff]">{row.assists}A</span>
                    )}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
                {row.points.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
