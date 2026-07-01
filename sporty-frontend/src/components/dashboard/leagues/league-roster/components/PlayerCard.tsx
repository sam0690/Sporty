"use client";

import { Flame, Snowflake } from "lucide-react";
import { SportIcon } from "@/components/landing/sport-icons";
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

export function PlayerCard({ player, showSportIcon }: PlayerCardProps) {
  return (
    <article className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-condensed text-base font-bold uppercase tracking-[0.02em] text-ink">
            {player.name}
          </p>
          {showSportIcon ? (
            <SportIcon
              sport={player.sport}
              className="h-4 w-4"
              tint
            />
          ) : null}
          {player.form === "hot" ? (
            <Flame className="h-4 w-4 text-primary" aria-label="In form" />
          ) : player.form === "cold" ? (
            <Snowflake className="h-4 w-4 text-info" aria-label="Out of form" />
          ) : null}
        </div>
        <span className="rounded-sm bg-surface-muted px-2 py-1 font-condensed text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {player.position}
        </span>
      </div>

      <p className="mt-1 text-xs text-ink-muted">{player.realTeam}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-ink-muted">Total</p>
          <p className="num font-semibold text-ink">{player.totalPoints}</p>
        </div>
        <div>
          <p className="text-ink-muted">Avg</p>
          <p className="num font-semibold text-ink">
            {player.avgPoints.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-ink-muted">Cost</p>
          <p className="num font-semibold text-primary">{player.cost}</p>
        </div>
      </div>
    </article>
  );
}

export type { Player };
