"use client";

import { X } from "lucide-react";
import { PlayerAvatar } from "@/components/ui";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type OwnedPlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints?: number;
  form?: number;
  realTeam?: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
};

type CurrentRosterProps = {
  players: OwnedPlayer[];
  onDrop: (id: string) => void;
  budget: number;
  maxPlayers: number;
  selectedOutId?: string;
  disabled?: boolean;
};

const sportAccentColor: Record<Exclude<Sport, "All">, string> = {
  football: "#00e07f",
  basketball: "#ff6b35",
  cricket: "#00d4ff",
};

export function CurrentRoster({
  players,
  onDrop,
  budget,
  maxPlayers,
  selectedOutId,
  disabled = false,
}: CurrentRosterProps) {
  const progressPercent = Math.min((players.length / maxPlayers) * 100, 100);

  return (
    <aside className="overflow-hidden card-surface lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <p className="section-label">Your Squad</p>
        <span className="font-bebas text-lg leading-none tracking-[1px] text-accent">
          {players.length}
          <span className="text-fg-3">/{maxPlayers}</span>
        </span>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto p-4">
        {players.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-3">
            No players in your squad.
          </p>
        ) : (
          players.map((player) => {
            const isSelected = selectedOutId === player.id;
            const accent =
              player.sport === "All"
                ? "#71717d"
                : sportAccentColor[player.sport];
            return (
              <div
                key={player.id}
                style={{ borderLeft: `3px solid ${accent}` }}
                className={`flex items-center gap-2.5 rounded-[3px] border px-2.5 py-2 transition-colors ${
                  isSelected
                    ? "border-accent/30 bg-accent/8"
                    : "border-white/8 bg-surface-3"
                }`}
              >
                <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size="sm" className="shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                    {player.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-fg-3">
                    {player.position}
                    <span className="mx-1 text-white/20">·</span>${player.price.toFixed(1)}M
                  </p>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDrop(player.id)}
                  className={`shrink-0 rounded-[3px] border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? "border-accent/40 text-accent"
                      : "border-white/8 text-fg-3 hover:border-[rgba(255,59,48,0.3)] hover:text-danger"
                  }`}
                  aria-label={`Stage out ${player.name}`}
                  title={isSelected ? "Staged out" : "Stage out"}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/8 p-4">
        <div className="flex items-center justify-between">
          <span className="section-label">In-Bank</span>
          <span className="font-bebas text-xl leading-none tracking-[1px] text-accent">
            ${budget.toFixed(1)}M
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-fg-3">
          <span>{players.length} Players</span>
          <span>Max {maxPlayers}</span>
        </div>
      </div>
    </aside>
  );
}

export type { OwnedPlayer };
