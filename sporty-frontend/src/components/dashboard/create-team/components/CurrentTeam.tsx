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
    <aside className="sticky top-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-foreground">
        Your Team ({players.length}/{requiredPlayers})
      </h2>

      <div className="mt-3 h-2 rounded-full bg-white/8">
        <div
          className="h-2 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="text-sm text-slate-400">No players added yet</p>
        ) : (
          players.map((player) => (
            <article
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {player.name}
                </p>
                <p className="text-xs text-slate-400">
                  {player.icon} {player.position} • ${player.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                className="rounded-full px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                aria-label={`Remove ${player.name}`}
              >
                X
              </button>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <p className="text-slate-400">
          Total:{" "}
          <span className="font-semibold text-foreground">${totalCost}</span>
        </p>
        <p className={remaining >= 0 ? "text-accent-primary" : "text-red-400"}>
          Remaining: ${remaining}
        </p>
      </div>
    </aside>
  );
}
