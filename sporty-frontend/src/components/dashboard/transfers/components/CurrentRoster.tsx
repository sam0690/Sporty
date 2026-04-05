"use client";

import { X } from "lucide-react";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type OwnedPlayer = {
  id: any;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints?: number;
  form?: number;
};

type CurrentRosterProps = {
  players: OwnedPlayer[];
  onDrop: (id: any) => void;
  budget: number;
  maxPlayers: number;
  selectedOutId?: any;
};

const sportIcons: Record<Exclude<Sport, "All">, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function CurrentRoster({ players, onDrop, budget, maxPlayers, selectedOutId }: CurrentRosterProps) {
  const totalSpent = players.reduce((sum, player) => sum + player.price, 0);
  const progressPercent = Math.min((players.length / maxPlayers) * 100, 100);

  return (
    <aside className="rounded-2xl border border-gray-100 bg-white p-5 lg:sticky lg:top-24">
      <div className="mb-4 border-b border-gray-100 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-md font-medium text-gray-900">Your Squad</h2>
          <span className="text-sm text-gray-500">({players.length}/{maxPlayers})</span>
        </div>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {players.map((player) => {
          const isSelected = selectedOutId === player.id;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all ${isSelected
                  ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100"
                  : "border-gray-100 bg-white"
                }`}
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${isSelected ? "text-primary-900" : "text-gray-700"}`}>
                  {player.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                  <span>{player.sport === "All" ? "🏟️" : sportIcons[player.sport]}</span>
                  <span>{player.position}</span>
                  <span className="text-gray-400">• ${player.price}M</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDrop(player.id)}
                className={`ml-2 transition-colors ${isSelected ? "text-primary-600" : "text-gray-400 hover:text-red-500"
                  }`}
                aria-label={`Drop ${player.name}`}
              >
                {isSelected ? (
                  <span className="text-[10px] font-bold uppercase">Active</span>
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
        <div className="flex items-center justify-between text-gray-600">
          <span>In-bank:</span>
          <span className="font-medium text-green-600">${budget.toFixed(1)}M</span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-primary-600" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-gray-400 font-medium">
          <span>{players.length} Players</span>
          <span>Max {maxPlayers}</span>
        </div>
      </div>
    </aside>
  );
}

export type { OwnedPlayer };
