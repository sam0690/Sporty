"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

// Podium tints for the top three ranks; the rest get a muted chip.
const RANK_STYLES = [
  "bg-gold/15 text-gold border-gold/30",
  "bg-white/10 text-foreground border-border",
  "bg-basketball/15 text-basketball border-basketball/30",
];

export function LiveLeaderboard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const players = useMatchStore((s) => s.players);

  const rows = useMemo(
    () =>
      Object.entries(playerPoints)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    [playerPoints],
  );

  return (
    <section className="glass rounded-xl p-5">
      <span className="section-label">Leaderboard</span>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No ranking data yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map(([playerId, points], idx) => {
            const rankStyle =
              RANK_STYLES[idx] ??
              "bg-white/5 text-muted-foreground border-border";
            return (
              <li
                key={playerId}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-700 tabular-nums ${rankStyle}`}
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-600 text-foreground">
                  {players[playerId]?.name ?? playerId}
                </span>
                <span className="stat-box-number text-base">
                  {points.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
