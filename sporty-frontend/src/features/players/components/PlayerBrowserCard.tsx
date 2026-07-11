"use client";

import Link from "next/link";
import { Badge, PlayerAvatar } from "@/components/ui";
import type { TPlayer } from "@/types";

export function PlayerBrowserCard({ player }: { player: TPlayer }) {
  const name = player.display_name || player.name || "Unknown Player";

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center justify-between gap-3 card-surface p-4 transition-colors hover:border-accent/30"
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={name} photoUrl={player.photo_url} />
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-700 text-fg-1">
            {name}
          </p>
          <p className="truncate text-xs text-fg-3">
            {player.position} · {player.real_team}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge sport={player.sport?.name} size="sm">
          {player.sport?.name}
        </Badge>
        <span className="stat-box-number text-base">
          {player.current_cost?.toFixed?.(1) ?? player.current_cost}
        </span>
      </div>
    </Link>
  );
}
