"use client";

import { PlayerCard } from "@/components/dashboard/leagues/league-lineup/components/PlayerCard";
import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";

type LineupContainerProps = {
  startersGroupedBySport: Record<string, LineupPlayerCardModel[]>;
  benchGroupedBySport: Record<string, LineupPlayerCardModel[]>;
  onToggleStarter: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  starterLimitReached: boolean;
  disabled?: boolean;
};

export function LineupContainer({
  startersGroupedBySport,
  benchGroupedBySport,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterLimitReached,
  disabled = false,
}: LineupContainerProps) {
  const starterSports = Object.entries(startersGroupedBySport);
  const benchSports = Object.entries(benchGroupedBySport);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Starting XI</h2>
        {starterSports.length === 0 ? (
          <p className="text-sm text-gray-500">No starters selected yet.</p>
        ) : (
          starterSports.map(([sportDisplayName, players]) => (
            <section key={`starter-${sportDisplayName}`} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {sportDisplayName}
                </h3>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
                  {players.length} players
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.playerId}
                    player={player}
                    onToggleStarter={onToggleStarter}
                    onSetCaptain={onSetCaptain}
                    onSetViceCaptain={onSetViceCaptain}
                    starterToggleDisabled={
                      disabled || (!player.isStarter && starterLimitReached)
                    }
                    disabled={disabled}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Bench</h2>
        {benchSports.length === 0 ? (
          <p className="text-sm text-gray-500">No bench players.</p>
        ) : (
          benchSports.map(([sportDisplayName, players]) => (
            <section key={`bench-${sportDisplayName}`} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {sportDisplayName}
                </h3>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
                  {players.length} players
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.playerId}
                    player={player}
                    onToggleStarter={onToggleStarter}
                    onSetCaptain={onSetCaptain}
                    onSetViceCaptain={onSetViceCaptain}
                    starterToggleDisabled={
                      disabled || (!player.isStarter && starterLimitReached)
                    }
                    disabled={disabled}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
