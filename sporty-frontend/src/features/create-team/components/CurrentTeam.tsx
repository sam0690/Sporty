"use client";

import { X } from "lucide-react";
import type { MarketPlayer } from "./PlayerCard";

type CurrentTeamProps = {
  players: MarketPlayer[];
  /** Omit when players can't be removed (draft picks are final) — hides the ✕ button. */
  onRemovePlayer?: (playerId: string) => void;
  budget: number;
  totalCost: number;
  requiredPlayers: number;
  /** Draft leagues have no budget — hides prices and the Total/Remaining footer. */
  showBudget?: boolean;
};

export function CurrentTeam({
  players,
  onRemovePlayer,
  budget,
  totalCost,
  requiredPlayers,
  showBudget = true,
}: CurrentTeamProps) {
  const remaining = budget - totalCost;
  const overBudget = remaining < 0;
  const progress = Math.min(
    100,
    Math.round((players.length / Math.max(requiredPlayers, 1)) * 100),
  );

  return (
    <aside className="sticky top-4 card-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Your Team</p>
        <p className="font-display text-xl leading-none tracking-[-0.02em] text-fg-1 tabular-nums">
          {players.length}
          <span className="text-fg-3">/{requiredPlayers}</span>
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-[3px] bg-surface-2">
        <div
          className="h-2 rounded-[3px] bg-accent transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="rounded-[3px] border border-dashed border-white/8 py-6 text-center text-xs text-fg-3">
            No players added yet
          </p>
        ) : (
          players.map((player) => (
            <article
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-[3px] border border-white/8 bg-surface-3 p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                  {player.name}
                </p>
                <p className="mt-0.5 text-xs text-fg-3">
                  {player.icon} {player.position}
                  {showBudget ? (
                    <>
                      {" "}
                      · <span className="text-fg-2">£{player.price.toFixed(1)}M</span>
                    </>
                  ) : null}
                </p>
              </div>
              {onRemovePlayer ? (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-[3px] text-fg-3 transition-colors hover:bg-[rgba(255,59,48,0.1)] hover:text-danger"
                  aria-label={`Remove ${player.name}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>

      {showBudget ? (
      <div className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="section-label">Total</span>
          <span className="font-display text-lg leading-none tracking-[-0.02em] text-fg-1 tabular-nums">
            £{totalCost.toFixed(1)}M
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="section-label">Remaining</span>
          <span
            className={`font-display text-lg leading-none tracking-[-0.02em] tabular-nums ${
              overBudget ? "text-danger" : "text-accent"
            }`}
          >
            £{remaining.toFixed(1)}M
          </span>
        </div>
      </div>
      ) : null}
    </aside>
  );
}
