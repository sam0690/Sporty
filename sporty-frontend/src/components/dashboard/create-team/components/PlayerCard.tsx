"use client";

import { Check, Plus } from "lucide-react";

type SportType = "football" | "basketball" | "cricket" | "multisport";

type MarketPlayer = {
  id: string;
  name: string;
  sport: SportType;
  icon: string;
  position: string;
  price: number;
  projected: number;
};

type PlayerCardProps = {
  player: MarketPlayer;
  onAdd: (player: MarketPlayer) => void;
  onRemove: (playerId: string) => void;
  isSelected: boolean;
  canAfford: boolean;
  showSportIcon?: boolean;
  canAddPlayer?: boolean;
  addDisabledReason?: string;
};

const sportBadgeClass: Record<SportType, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  multisport: "sport-badge-multisport",
};

export function PlayerCard({
  player,
  onAdd,
  onRemove,
  isSelected,
  canAfford,
  showSportIcon = true,
  canAddPlayer = true,
  addDisabledReason = "Action unavailable",
}: PlayerCardProps) {
  const addDisabled = !canAfford || !canAddPlayer;
  const addButtonTitle = !canAfford
    ? "Insufficient budget"
    : !canAddPlayer
      ? addDisabledReason
      : "Add player";

  return (
    <article
      className={`flex items-center justify-between gap-3 rounded-[3px] border p-3 transition-colors ${
        isSelected
          ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.06)]"
          : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {player.name}
          </p>
          {showSportIcon ? (
            <span aria-label={player.sport}>{player.icon}</span>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${sportBadgeClass[player.sport]}`}
          >
            {player.position}
          </span>
          <span className="font-bebas text-base leading-none tracking-[1px] text-[#e8fb25]">
            ${player.price}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#555560]">
          Proj <span className="tabular-nums">{player.projected.toFixed(1)}</span>
        </p>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="inline-flex items-center gap-1 rounded-[3px] border border-[rgba(232,251,37,0.3)] px-2.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.1)]"
        >
          <Check size={13} />
          Added
        </button>
      ) : (
        <button
          type="button"
          disabled={addDisabled}
          title={addButtonTitle}
          onClick={() => onAdd(player)}
          className="inline-flex items-center gap-1 rounded-[3px] bg-[#e8fb25] px-2.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-black transition-colors hover:bg-[#f2ff5a] disabled:cursor-not-allowed disabled:bg-[#1d1d26] disabled:text-[#555560]"
        >
          <Plus size={13} />
          Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
