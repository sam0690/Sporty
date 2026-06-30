"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Leaderboard</span>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#555560]">No ranking data yet.</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {rows.map(([playerId, points], idx) => {
            const isTop = idx === 0;
            return (
              <li
                key={playerId}
                className="flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                <span
                  className={`w-6 shrink-0 text-center font-bebas text-lg leading-none ${
                    isTop ? "text-[#e8fb25]" : "text-[#555560]"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                  {players[playerId]?.name ?? playerId}
                </span>
                <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
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
