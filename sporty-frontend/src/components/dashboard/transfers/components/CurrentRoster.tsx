"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type OwnedPlayer = {
  id: number;
  name: string;
  sport: Sport;
  position: string;
  price: number;
};

type CurrentRosterProps = {
  players: OwnedPlayer[];
  onDrop: (id: number) => void;
};

const sportBadgeStyles: Record<Exclude<Sport, "All">, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

export function CurrentRoster({ players, onDrop }: CurrentRosterProps) {
  return (
    <aside className="rounded-lg bg-surface-100 p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Current Team</h2>
        <span className="text-sm text-text-secondary">{players.length}/20 players</span>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {players.map((player) => {
          const badgeClass =
            player.sport === "All"
              ? "bg-surface-200 text-text-secondary"
              : sportBadgeStyles[player.sport];

          return (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{player.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 capitalize ${badgeClass}`}>
                    {player.sport}
                  </span>
                  <span className="text-text-secondary">{player.position}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDrop(player.id)}
                className="ml-2 text-red-500 transition-colors hover:text-red-700"
                aria-label={`Drop ${player.name}`}
              >
                X
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export type { OwnedPlayer };
