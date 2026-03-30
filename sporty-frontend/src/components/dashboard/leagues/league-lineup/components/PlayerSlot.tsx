"use client";

type Sport = "football" | "basketball" | "cricket";

type Player = {
  id: number;
  name: string;
  sport: Sport;
  position: string;
  projected: number;
};

type PlayerSlotProps = {
  player: Player;
  onToggle: (playerId: number) => void;
  isActive: boolean;
  disabled?: boolean;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function PlayerSlot({ player, onToggle, isActive, disabled = false }: PlayerSlotProps) {
  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) {
          onToggle(player.id);
        }
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(player.id);
        }
      }}
      className={`flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-all hover:shadow-card-hover ${
        isActive
          ? "border-l-4 border-l-primary-500 bg-primary-50/30"
          : "bg-surface-100 opacity-80"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      aria-disabled={disabled}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-text-primary">{player.name}</p>
          <span className={`rounded px-2 py-1 text-xs capitalize ${sportBadgeStyles[player.sport]}`}>
            {sportIcons[player.sport]} {player.sport}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-text-secondary">
            {player.position}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-primary-600">
          Projected: {player.projected.toFixed(1)}
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            onToggle(player.id);
          }
        }}
        className="rounded-lg bg-primary-500 px-3 py-2 text-sm text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
      >
        {isActive ? "Bench" : "Start"}
      </button>
    </article>
  );
}

export type { Player, Sport };
