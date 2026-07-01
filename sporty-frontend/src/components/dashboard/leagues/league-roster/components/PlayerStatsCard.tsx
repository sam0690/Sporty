"use client";

import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type PlayerStatsCardProps = {
  player: Player;
};

export function PlayerStatsCard({ player }: PlayerStatsCardProps) {
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 min-w-[160px] -translate-x-1/2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-slate-950 p-3 text-left text-[#0B1220] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <p className="text-xs font-semibold text-[#0B1220]">{player.name}</p>
      <p className="mt-0.5 text-[11px] text-[#6B7280]">{player.position}</p>

      <div className="mt-2 space-y-0.5 text-[11px] text-[#6B7280]">
        <p>
          Total Points:{" "}
          <span className="font-medium text-[#0B1220]">
            {player.totalPoints}
          </span>
        </p>
        <p>
          Avg Points:{" "}
          <span className="font-medium text-[#0B1220]">
            {player.avgPoints.toFixed(1)}
          </span>
        </p>
        <p>
          Projected:{" "}
          <span className="font-medium text-[#0B1220]">
            {player.projected ? player.projected.toFixed(1) : "-"}
          </span>
        </p>
      </div>

      <div
        className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-[rgba(11,18,32,0.08)] bg-slate-950"
        aria-hidden="true"
      />
    </div>
  );
}
