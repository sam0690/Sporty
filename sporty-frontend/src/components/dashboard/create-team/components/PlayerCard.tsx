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
  multisport: "bg-accent-primary/10 text-accent-primary",
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
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-foreground">
            {player.name}
          </p>
          {showSportIcon ? (
            <span aria-label={player.sport}>{player.icon}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs ${sportBadgeStyles[player.sport]}`}
          >
            {player.position}
          </span>
          <span className="text-sm font-bold text-accent-primary">
            ${player.price}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Proj: {player.projected.toFixed(1)}
        </p>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="rounded-full border border-accent-primary/20 px-2 py-1 text-xs text-accent-primary hover:bg-accent-primary/10"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          disabled={addDisabled}
          title={addButtonTitle}
          onClick={() => onAdd(player)}
          className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-2 py-1 text-xs font-semibold text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
