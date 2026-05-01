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
    <aside className="sticky top-4 rounded-lg bg-[#F4F4F9] p-4 shadow-card">
      <h2 className="text-lg font-semibold text-black">
        Your Team ({players.length}/{requiredPlayers})
      </h2>

      <div className="mt-3 h-2 rounded-full bg-accent/30">
        <div
          className="h-2 rounded-full bg-primary/100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="text-sm text-secondary">No players added yet</p>
        ) : (
          players.map((player) => (
            <article
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-black">
                  {player.name}
                </p>
                <p className="text-xs text-secondary">
                  {player.icon} {player.position} • ${player.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/5"
                aria-label={`Remove ${player.name}`}
              >
                X
              </button>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <p className="text-secondary">
          Total:{" "}
          <span className="font-semibold text-black">${totalCost}</span>
        </p>
        <p className={remaining >= 0 ? "text-primary" : "text-danger"}>
          Remaining: ${remaining}
        </p>
      </div>
    </aside>
  );
}
