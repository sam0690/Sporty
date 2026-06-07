"use client";

import { X } from "lucide-react";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type OwnedPlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints?: number;
  form?: number;
};

type CurrentRosterProps = {
  players: OwnedPlayer[];
  onDrop: (id: string) => void;
  budget: number;
  maxPlayers: number;
  selectedOutId?: string;
  disabled?: boolean;
};

const sportIcons: Record<Exclude<Sport, "All">, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
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
    <aside className="rounded-[1.75rem] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5  lg:sticky lg:top-24">
      <div className="mb-4 border-b border-[rgba(255,255,255,0.08)] pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-md font-600 text-[#f0f0f0]">Your Squad</h2>
          <span className="text-sm text-[#555560]">
            ({players.length}/{maxPlayers})
          </span>
        </div>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {players.map((player) => {
          const isSelected = selectedOutId === player.id;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-[3px] border px-3 py-2 transition-all ${
                isSelected
                  ? "border-accent-primary/25 bg-[rgba(232,251,37,0.1)] ring-1 ring-accent-primary/20"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26]"
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-sm ${isSelected ? "text-primary-900" : "text-white"}`}
                >
                  {player.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#555560]">
                  <span>
                    {player.sport === "All" ? "🏟️" : sportIcons[player.sport]}
                  </span>
                  <span>{player.position}</span>
                  <span className="text-[#555560]">• ${player.price}M</span>
                </div>
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onDrop(player.id)}
                className={`ml-2 transition-colors ${
                  isSelected
                    ? "text-[#e8fb25]"
                    : "text-[#555560] hover:text-danger"
                }`}
                aria-label={`Drop ${player.name}`}
              >
                {isSelected ? (
                  <span className="text-[10px] font-700 uppercase">
                    Active
                  </span>
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-accent/20 pt-3 text-sm">
        <div className="flex items-center justify-between text-secondary">
          <span>In-bank:</span>
          <span className="font-medium text-[#e8fb25]">
            ${budget.toFixed(1)}M
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-[3px] bg-[#1d1d26]">
          <div
            className="h-full rounded-[3px] bg-linear-to-r [#e8fb25]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-[#555560]">
          <span>{players.length} Players</span>
          <span>Max {maxPlayers}</span>
        </div>
      </div>
    </aside>
  );
}

export type { OwnedPlayer };
