"use client";

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

const sportBadgeStyles: Record<SportType, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
  multisport: "bg-primary/15 text-primary",
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
    <article className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#F4F4F9] p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-black">
            {player.name}
          </p>
          {showSportIcon ? (
            <span aria-label={player.sport}>{player.icon}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-xs ${sportBadgeStyles[player.sport]}`}
          >
            {player.position}
          </span>
          <span className="text-sm font-bold text-primary">
            ${player.price}
          </span>
        </div>
        <p className="mt-1 text-sm text-secondary">
          Proj: {player.projected.toFixed(1)}
        </p>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="rounded-md border border-primary-500 px-2 py-1 text-xs text-primary-500 hover:bg-primary/10"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          disabled={addDisabled}
          title={addButtonTitle}
          onClick={() => onAdd(player)}
          className="rounded-md bg-primary/100 px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
