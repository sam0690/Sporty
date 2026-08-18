"use client";

import { Badge, CountryFlag, PlayerAvatar, StatTile, TeamLogo } from "@/components/ui";
import type { TPlayer } from "@/types";

type PlayerHeroProps = {
  player: TPlayer;
  size?: "compact" | "large";
};

const SPORT_WASH: Record<string, string> = {
  football: "sport-wash-football",
  basketball: "sport-wash-basketball",
  cricket: "sport-wash-cricket",
  rugby: "sport-wash-rugby",
};

function sportWashClass(sportName?: string): string {
  return SPORT_WASH[sportName?.toLowerCase() ?? ""] ?? "sport-wash-multisport";
}

export function PlayerHero({ player, size = "compact" }: PlayerHeroProps) {
  const isLarge = size === "large";
  const hasProjection = player.projected_points !== null && player.projected_points !== undefined;

  return (
    <div className={`${sportWashClass(player.sport?.name)} px-6 ${isLarge ? "pb-6 pt-10" : "pb-4 pt-6"}`}>
      <div
        className={`flex gap-4 ${
          isLarge
            ? "flex-col items-center text-center sm:flex-row sm:items-end sm:text-left"
            : "items-start"
        }`}
      >
        <PlayerAvatar name={player.display_name} photoUrl={player.photo_url} size={isLarge ? "xl" : "lg"} />
        <div className="min-w-0 flex-1 pt-1">
          <h2
            className={`truncate font-display tracking-[-0.01em] text-fg-1 ${
              isLarge ? "text-3xl sm:text-4xl" : "text-lg font-700"
            }`}
          >
            {player.display_name}
          </h2>
          <div className={`mt-1.5 flex items-center gap-2 ${isLarge ? "justify-center sm:justify-start" : ""}`}>
            <TeamLogo
              teamName={player.real_team}
              logoUrl={player.real_team_logo_url}
              size={isLarge ? "md" : "sm"}
            />
            <span className="text-sm text-fg-2">{player.real_team}</span>
            <Badge sport={player.sport?.name} size="sm">
              {player.position}
            </Badge>
            <CountryFlag
              nationality={player.nationality}
              flagUrl={player.flag_url}
              size={isLarge ? "md" : "sm"}
            />
          </div>
          <div className={`mt-3 flex gap-6 ${isLarge ? "justify-center sm:justify-start" : ""}`}>
            <StatTile
              label="Price"
              value={`£${player.current_cost.toFixed(1)}m`}
              size={isLarge ? "default" : "sm"}
            />
            {hasProjection && (
              <StatTile
                label="Proj. Pts"
                value={(player.projected_points as number).toFixed(1)}
                size={isLarge ? "default" : "sm"}
                tone="neutral"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
