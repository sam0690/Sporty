"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

export function PointsCard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);

  const leaders = useMemo(
    () =>
      Object.entries(playerPoints)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [playerPoints],
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="text-xs uppercase tracking-wider text-foreground/55">
        Top Fantasy Points
      </div>
      <ul className="mt-3 space-y-2 text-sm text-foreground/70">
        {leaders.length === 0 && <li>No live deltas yet.</li>}
        {leaders.map(([playerId, points]) => (
          <li key={playerId} className="flex items-center justify-between">
            <span className="truncate">{playerId}</span>
            <span className="font-semibold text-foreground">
              {points.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
