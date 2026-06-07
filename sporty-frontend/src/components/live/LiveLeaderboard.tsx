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
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Leaderboard
      </div>
      <div className="mt-3 space-y-2 text-sm text-[#555560]">
        {rows.length === 0 && <p>No ranking data yet.</p>}
        {rows.map(([playerId, points], idx) => (
          <div key={playerId} className="flex items-center justify-between">
            <span className="font-medium text-[#555560]">#{idx + 1}</span>
            <span className="truncate px-3">{playerId}</span>
            <span className="font-600 text-[#f0f0f0]">
              {points.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
