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
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Top Fantasy Points
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#555560]">
        {leaders.length === 0 && <li>No live deltas yet.</li>}
        {leaders.map(([playerId, points]) => (
          <li key={playerId} className="flex items-center justify-between">
            <span className="truncate">{playerId}</span>
            <span className="font-600 text-[#f0f0f0]">
              {points.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
