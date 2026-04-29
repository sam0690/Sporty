"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";

export function LiveLeaderboard() {
  const playerPoints = useMatchStore((s) => s.playerPoints);

  const rows = useMemo(
    () =>
      Object.entries(playerPoints)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    [playerPoints],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Leaderboard
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {rows.length === 0 && <p>No ranking data yet.</p>}
        {rows.map(([playerId, points], idx) => (
          <div key={playerId} className="flex items-center justify-between">
            <span className="font-medium text-slate-500">#{idx + 1}</span>
            <span className="truncate px-3">{playerId}</span>
            <span className="font-semibold text-slate-900">
              {points.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
