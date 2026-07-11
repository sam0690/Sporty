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

function SportGroup({
  sportDisplayName,
  players,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterLimitReached,
  disabled,
}: {
  sportDisplayName: string;
  players: LineupPlayerCardModel[];
  onToggleStarter: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  starterLimitReached: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-fg-2">
          {sportDisplayName}
        </h3>
        <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-fg-3">
          {players.length} players
        </span>
      </div>

      <div className="space-y-2">
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
  );
}

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
    <div className="space-y-4">
      <div className="overflow-hidden card-surface">
        <header className="border-b border-white/8 px-5 py-3">
          <p className="section-label">Starting Lineup</p>
        </header>
        <div className="space-y-5 p-5">
          {starterSports.length === 0 ? (
            <p className="text-sm text-fg-3">No starters selected yet.</p>
          ) : (
            starterSports.map(([sportDisplayName, players]) => (
              <SportGroup
                key={`starter-${sportDisplayName}`}
                sportDisplayName={sportDisplayName}
                players={players}
                onToggleStarter={onToggleStarter}
                onSetCaptain={onSetCaptain}
                onSetViceCaptain={onSetViceCaptain}
                starterLimitReached={starterLimitReached}
                disabled={disabled}
              />
            ))
          )}
        </div>
      </div>

      <div className="overflow-hidden card-surface">
        <header className="border-b border-white/8 px-5 py-3">
          <p className="section-label">Bench</p>
        </header>
        <div className="space-y-5 p-5">
          {benchSports.length === 0 ? (
            <p className="text-sm text-fg-3">No bench players.</p>
          ) : (
            benchSports.map(([sportDisplayName, players]) => (
              <SportGroup
                key={`bench-${sportDisplayName}`}
                sportDisplayName={sportDisplayName}
                players={players}
                onToggleStarter={onToggleStarter}
                onSetCaptain={onSetCaptain}
                onSetViceCaptain={onSetViceCaptain}
                starterLimitReached={starterLimitReached}
                disabled={disabled}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
