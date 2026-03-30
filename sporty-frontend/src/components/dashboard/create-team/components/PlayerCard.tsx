"use client";

type SportType = "football" | "basketball" | "cricket";

type MarketPlayer = {
  id: number;
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
  onRemove: (playerId: number) => void;
  isSelected: boolean;
  canAfford: boolean;
  showSportIcon?: boolean;
};

const sportBadgeStyles: Record<SportType, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

export function PlayerCard({ player, onAdd, onRemove, isSelected, canAfford, showSportIcon = true }: PlayerCardProps) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-100 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-text-primary">{player.name}</p>
          {showSportIcon ? <span aria-label={player.sport}>{player.icon}</span> : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded px-2 py-1 text-xs ${sportBadgeStyles[player.sport]}`}>{player.position}</span>
          <span className="text-sm font-bold text-primary-600">${player.price}</span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">Proj: {player.projected.toFixed(1)}</p>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="rounded-md border border-primary-500 px-2 py-1 text-xs text-primary-500 hover:bg-primary-50"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          disabled={!canAfford}
          title={!canAfford ? "Insufficient budget" : "Add player"}
          onClick={() => onAdd(player)}
          className="rounded-md bg-primary-500 px-2 py-1 text-xs font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
