"use client";

import { Check, Plus } from "lucide-react";
import { Badge, CountryFlag, PlayerAvatar, TeamLogo } from "@/components/ui";

type SportType = "football" | "basketball" | "cricket" | "multisport";

type MarketPlayer = {
  id: string;
  name: string;
  sport: SportType;
  icon: string;
  position: string;
  realTeam?: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  nationality?: string | null;
  flagUrl?: string | null;
  price: number;
  projected: number;
};

type PlayerCardProps = {
  player: MarketPlayer;
  onAdd: (player: MarketPlayer) => void;
  onRemove: (playerId: string) => void;
  isSelected: boolean;
  canAfford: boolean;
  /** Draft leagues have no budget — hides the price tag. */
  showPrice?: boolean;
  showSportIcon?: boolean;
  canAddPlayer?: boolean;
  addDisabledReason?: string;
};

export function PlayerCard({
  player,
  onAdd,
  onRemove,
  isSelected,
  canAfford,
  showPrice = true,
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
          ? "border-accent/30 bg-accent/6"
          : "border-white/8 bg-surface-3"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
              {player.name}
            </p>
            {showSportIcon ? (
              <span aria-label={player.sport}>{player.icon}</span>
            ) : null}
            <CountryFlag nationality={player.nationality} flagUrl={player.flagUrl} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge sport={player.sport} size="sm">
              {player.position}
            </Badge>
            {player.realTeam ? (
              <span className="flex items-center gap-1.5 text-xs text-fg-3">
                <TeamLogo teamName={player.realTeam} logoUrl={player.realTeamLogoUrl} size="sm" />
                {player.realTeam}
              </span>
            ) : null}
            {showPrice ? (
              <span className="font-display text-base leading-none tracking-[-0.02em] text-accent">
                £{player.price.toFixed(1)}M
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-fg-3">
            Proj <span className="tabular-nums">{player.projected.toFixed(1)}</span>
          </p>
        </div>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="inline-flex items-center gap-1 rounded-[3px] border border-accent/30 px-2.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-accent transition-colors hover:bg-accent/10"
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
          className="inline-flex items-center gap-1 rounded-[3px] bg-accent px-2.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3"
        >
          <Plus size={13} />
          Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
