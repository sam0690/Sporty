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
  multisport: "bg-[rgba(232,251,37,0.1)] text-[#e8fb25]",
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
    <article className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-600 text-[#f0f0f0]">
            {player.name}
          </p>
          {showSportIcon ? (
            <span aria-label={player.sport}>{player.icon}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded-[3px] px-2 py-1 text-xs ${sportBadgeStyles[player.sport]}`}
          >
            {player.position}
          </span>
          <span className="text-sm font-700 text-[#e8fb25]">
            ${player.price}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#555560]">
          Proj: {player.projected.toFixed(1)}
        </p>
      </div>

      {isSelected ? (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="rounded-[3px] border border-[rgba(232,251,37,0.2)] px-2 py-1 text-xs text-[#e8fb25] hover:bg-[rgba(232,251,37,0.1)]"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          disabled={addDisabled}
          title={addButtonTitle}
          onClick={() => onAdd(player)}
          className="rounded-[3px] bg-linear-to-r [#e8fb25] px-2 py-1 text-xs font-600 text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      )}
    </article>
  );
}

export type { MarketPlayer, SportType };
