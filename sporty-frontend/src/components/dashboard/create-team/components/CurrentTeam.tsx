"use client";

import { X } from "lucide-react";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";

type CurrentTeamProps = {
  players: MarketPlayer[];
  onRemovePlayer: (playerId: string) => void;
  budget: number;
  totalCost: number;
  requiredPlayers: number;
};

export function CurrentTeam({
  players,
  onRemovePlayer,
  budget,
  totalCost,
  requiredPlayers,
}: CurrentTeamProps) {
  const remaining = budget - totalCost;
  const overBudget = remaining < 0;
  const progress = Math.min(
    100,
    Math.round((players.length / Math.max(requiredPlayers, 1)) * 100),
  );

  return (
    <aside className="sticky top-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Your Team</p>
        <p className="font-bebas text-xl leading-none tracking-[1px] text-[#f0f0f0] tabular-nums">
          {players.length}
          <span className="text-[#555560]">/{requiredPlayers}</span>
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-[3px] bg-[#0d0d12]">
        <div
          className="h-2 rounded-[3px] bg-[#e8fb25] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] py-6 text-center text-xs text-[#555560]">
            No players added yet
          </p>
        ) : (
          players.map((player) => (
            <article
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                  {player.name}
                </p>
                <p className="mt-0.5 text-xs text-[#555560]">
                  {player.icon} {player.position} ·{" "}
                  <span className="text-[#9a9aa5]">${player.price.toFixed(1)}M</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                className="grid size-7 shrink-0 place-items-center rounded-[3px] text-[#555560] transition-colors hover:bg-[rgba(255,59,48,0.1)] hover:text-[#ff3b30]"
                aria-label={`Remove ${player.name}`}
              >
                <X size={14} />
              </button>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 space-y-1.5 border-t border-[rgba(255,255,255,0.08)] pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="section-label">Total</span>
          <span className="font-bebas text-lg leading-none tracking-[1px] text-[#f0f0f0] tabular-nums">
            ${totalCost.toFixed(1)}M
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="section-label">Remaining</span>
          <span
            className={`font-bebas text-lg leading-none tracking-[1px] tabular-nums ${
              overBudget ? "text-[#ff3b30]" : "text-[#e8fb25]"
            }`}
          >
            ${remaining.toFixed(1)}M
          </span>
        </div>
      </div>
    </aside>
  );
}
