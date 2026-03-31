"use client";

import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type PlayerStatsCardProps = {
  player: Player;
};

export function PlayerStatsCard({ player }: PlayerStatsCardProps) {
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 min-w-[160px] -translate-x-1/2 rounded-xl bg-white p-3 text-left shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <p className="text-xs font-semibold text-gray-900">{player.name}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{player.position}</p>

      <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
        <p>Total Points: <span className="font-medium text-gray-900">{player.totalPoints}</span></p>
        <p>Avg Points: <span className="font-medium text-gray-900">{player.avgPoints.toFixed(1)}</span></p>
        <p>Projected: <span className="font-medium text-gray-900">{player.projected ? player.projected.toFixed(1) : "-"}</span></p>
      </div>

      <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 bg-white" aria-hidden="true" />
    </div>
  );
}
