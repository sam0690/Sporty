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

const sportAccentColor: Record<Exclude<Sport, "All">, string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
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
    <aside className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <p className="section-label">Your Squad</p>
        <span className="font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
          {players.length}
          <span className="text-[#555560]">/{maxPlayers}</span>
        </span>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto p-4">
        {players.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#555560]">
            No players in your squad.
          </p>
        ) : (
          players.map((player) => {
            const isSelected = selectedOutId === player.id;
            const accent =
              player.sport === "All"
                ? "#555560"
                : sportAccentColor[player.sport];
            return (
              <div
                key={player.id}
                style={{ borderLeft: `3px solid ${accent}` }}
                className={`flex items-center justify-between gap-2 rounded-[3px] border px-3 py-2 transition-colors ${
                  isSelected
                    ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.08)]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                    {player.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#555560]">
                    {player.position}
                    <span className="mx-1 text-[#33333a]">·</span>${player.price}M
                  </p>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDrop(player.id)}
                  className={`shrink-0 rounded-[3px] border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? "border-[rgba(232,251,37,0.4)] text-[#e8fb25]"
                      : "border-[rgba(255,255,255,0.08)] text-[#555560] hover:border-[rgba(255,59,48,0.3)] hover:text-[#ff3b30]"
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

      <div className="border-t border-[rgba(255,255,255,0.08)] p-4">
        <div className="flex items-center justify-between">
          <span className="section-label">In-Bank</span>
          <span className="font-bebas text-xl leading-none tracking-[1px] text-[#e8fb25]">
            ${budget.toFixed(1)}M
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1d1d26]">
          <div
            className="h-full rounded-full bg-[#e8fb25]"
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
