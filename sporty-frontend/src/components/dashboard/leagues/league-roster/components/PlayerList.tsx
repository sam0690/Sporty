"use client";

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DropZone } from "@/components/dashboard/leagues/league-roster/components/DropZone";
import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type PlayerListProps = {
  players: Player[];
  selectedSport: string;
  selectedPosition: string;
  onSportChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  sports: string[];
  positions: string[];
};

type DraggablePlayerCardProps = {
  player: Player;
};

const sportIcons = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

function DraggablePlayerCard({ player }: DraggablePlayerCardProps) {
  const draggable = useDraggable({
    id: `player-${player.id}`,
    data: {
      type: "player",
      playerId: player.id,
      from: "list",
    },
  });

  const style = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.45 : 1,
  };

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      {...draggable.listeners}
      {...draggable.attributes}
      className="cursor-grab rounded-lg border border-border bg-white p-3 shadow-card transition hover:shadow-card-hover"
      title={`${player.name} | ${player.position} | Total ${player.totalPoints} | Avg ${player.avgPoints.toFixed(1)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-text-primary">{player.name}</p>
        <span className="text-base" aria-label={player.sport}>{sportIcons[player.sport]}</span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">{player.position}</p>
      <p className="mt-1 text-xs font-medium text-primary-600">{player.totalPoints} pts</p>
    </article>
  );
}

export function PlayerList({
  players,
  selectedSport,
  selectedPosition,
  onSportChange,
  onPositionChange,
  sports,
  positions,
}: PlayerListProps) {
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"sport" | "position">("sport");

  const visiblePlayers = useMemo(() => {
    const lower = query.trim().toLowerCase();

    return players.filter((player) => {
      const sportOk = selectedSport === "All" || player.sport === selectedSport;
      const positionOk = selectedPosition === "All" || player.position === selectedPosition;
      const queryOk = lower.length === 0 || player.name.toLowerCase().includes(lower);
      return sportOk && positionOk && queryOk;
    });
  }, [players, selectedSport, selectedPosition, query]);

  const groupedPlayers = useMemo(() => {
    return visiblePlayers.reduce<Record<string, Player[]>>((acc, player) => {
      const key = groupBy === "sport" ? player.sport : player.position;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(player);
      return acc;
    }, {});
  }, [visiblePlayers, groupBy]);

  return (
    <DropZone
      id="bench-drop"
      className="space-y-4 rounded-xl border border-border bg-surface-100 p-4"
      activeClassName="border-primary-500 bg-primary-50/40"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-text-primary">Available Players</h3>
        <p className="text-xs text-text-secondary">Drop here to bench</p>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name..."
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedSport}
          onChange={(event) => onSportChange(event.target.value)}
          className="rounded-lg border border-border bg-white px-2 py-2 text-xs text-text-primary"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>{sport}</option>
          ))}
        </select>
        <select
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-lg border border-border bg-white px-2 py-2 text-xs text-text-primary"
        >
          {positions.map((position) => (
            <option key={position} value={position}>{position}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGroupBy("sport")}
          className={`rounded-md px-2 py-1 text-xs ${groupBy === "sport" ? "bg-primary-500 text-white" : "bg-white text-text-secondary"}`}
        >
          Group: Sport
        </button>
        <button
          type="button"
          onClick={() => setGroupBy("position")}
          className={`rounded-md px-2 py-1 text-xs ${groupBy === "position" ? "bg-primary-500 text-white" : "bg-white text-text-secondary"}`}
        >
          Group: Position
        </button>
      </div>

      <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
        {Object.keys(groupedPlayers).length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-3 text-sm text-text-secondary">No players found.</p>
        ) : (
          Object.entries(groupedPlayers).map(([group, groupPlayers]) => (
            <section key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{group}</p>
              <div className="space-y-2">
                {groupPlayers.map((player) => (
                  <DraggablePlayerCard key={player.id} player={player} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </DropZone>
  );
}
