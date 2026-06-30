"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

export function PointsCard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const players = useMatchStore((s) => s.players);

  const leaders = useMemo(
    () =>
      Object.entries(playerPoints)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [playerPoints],
  );

  const topScore = leaders[0]?.[1] ?? 0;

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Top Fantasy Points</span>

      {leaders.length === 0 ? (
        <p className="mt-4 text-sm text-[#555560]">No live deltas yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {leaders.map(([playerId, points]) => {
            const pct = topScore > 0 ? Math.max(6, (points / topScore) * 100) : 0;
            return (
              <li key={playerId} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                    {players[playerId]?.name ?? playerId}
                  </span>
                  <span className="shrink-0 font-bebas text-base leading-none tracking-[1px] text-[#e8fb25]">
                    {points.toFixed(1)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                  <div
                    className="h-full rounded-full bg-[#e8fb25]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
