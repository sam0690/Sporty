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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Top Fantasy Points
      </div>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {leaders.length === 0 && <li>No live deltas yet.</li>}
        {leaders.map(([playerId, points]) => (
          <li key={playerId} className="flex items-center justify-between">
            <span className="truncate">{playerId}</span>
            <span className="font-semibold text-slate-900">
              {points.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
