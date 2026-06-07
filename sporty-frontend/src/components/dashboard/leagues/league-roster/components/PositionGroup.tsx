"use client";

import {
  PlayerCard,
  type Player,
} from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type PositionGroupProps = {
  position: string;
  players: Player[];
  showSportIcon: boolean;
};

export function PositionGroup({
  position,
  players,
  showSportIcon,
}: PositionGroupProps) {
  return (
    <section>
      <header className="mb-3 border-b border-[rgba(255,255,255,0.08)] pb-2">
        <h3 className="text-lg font-600 text-[#f0f0f0]">
          {position} ({players.length})
        </h3>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            showSportIcon={showSportIcon}
          />
        ))}
      </div>
    </section>
  );
}
