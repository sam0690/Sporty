"use client";

import type { Sport } from "@/components/dashboard/leagues/league-roster/components/RosterHeader";

type Player = {
  id: number;
  name: string;
  sport: Exclude<Sport, "multisport">;
  position: string;
  realTeam: string;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  projected?: number;
  form?: "hot" | "cold" | "normal";
};

type PlayerCardProps = {
  player: Player;
  showSportIcon: boolean;
};

const sportIcons: Record<Exclude<Sport, "multisport">, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function PlayerCard({ player, showSportIcon }: PlayerCardProps) {
  const formBadge =
    player.form === "hot" ? "🔥" : player.form === "cold" ? "❄️" : "";

  return (
    <article className="rounded-lg border border-border bg-[#F4F4F9] p-4 transition hover:shadow-card-hover">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-black">{player.name}</p>
          {showSportIcon ? (
            <span className="text-sm" aria-label={player.sport}>
              {sportIcons[player.sport]}
            </span>
          ) : null}
        </div>
        <span className="rounded bg-accent/20 px-2 py-1 text-xs text-secondary">
          {player.position}
        </span>
      </div>

      <p className="mt-1 text-xs text-secondary">{player.realTeam}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-secondary">Total</p>
          <p className="font-medium text-black">{player.totalPoints}</p>
        </div>
        <div>
          <p className="text-secondary">Avg</p>
          <p className="font-medium text-black">
            {player.avgPoints.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-secondary">Cost</p>
          <p className="font-medium text-primary">{player.cost}</p>
        </div>
      </div>

      {formBadge ? <p className="mt-2 text-sm">{formBadge}</p> : null}
    </article>
  );
}

export type { Player };
