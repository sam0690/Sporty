"use client";

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
  const progress = Math.min(
    100,
    Math.round((players.length / requiredPlayers) * 100),
  );

  return (
    <aside className="sticky top-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <h2 className="text-lg font-600 text-[#f0f0f0]">
        Your Team ({players.length}/{requiredPlayers})
      </h2>

      <div className="mt-3 h-2 rounded-[3px] bg-[#1d1d26]">
        <div
          className="h-2 rounded-[3px] bg-linear-to-r [#e8fb25]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="text-sm text-[#555560]">No players added yet</p>
        ) : (
          players.map((player) => (
            <article
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[#f0f0f0]">
                  {player.name}
                </p>
                <p className="text-xs text-[#555560]">
                  {player.icon} {player.position} • ${player.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                className="rounded-[3px] px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                aria-label={`Remove ${player.name}`}
              >
                X
              </button>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <p className="text-[#555560]">
          Total:{" "}
          <span className="font-600 text-[#f0f0f0]">${totalCost}</span>
        </p>
        <p className={remaining >= 0 ? "text-[#e8fb25]" : "text-red-400"}>
          Remaining: ${remaining}
        </p>
      </div>
    </aside>
  );
}
