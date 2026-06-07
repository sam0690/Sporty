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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `player-${player.id}`,
      data: {
        type: "player",
        playerId: player.id,
        from: "list",
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 transition hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26]"
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-600 text-[#f0f0f0]">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {sportIcons[player.sport]}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#555560]">{player.position}</p>
      <p className="mt-1 truncate text-xs text-[#555560]">{player.realTeam}</p>
      <p className="mt-1 text-xs text-[#e8fb25]">
        Cost {player.cost}
      </p>
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
      const positionOk =
        selectedPosition === "All" || player.position === selectedPosition;
      const queryOk =
        lower.length === 0 || player.name.toLowerCase().includes(lower);
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
      className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 "
      activeClassName="border-[rgba(232,251,37,0.2)] bg-[rgba(232,251,37,0.1)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-600 text-[#f0f0f0]">
          Available Players
        </h3>
        <p className="text-xs text-[#555560]">Drop here to bench</p>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name..."
        className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedSport}
          onChange={(event) => onSportChange(event.target.value)}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2 py-2 text-xs text-[#f0f0f0] outline-none"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
        <select
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2 py-2 text-xs text-[#f0f0f0] outline-none"
        >
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGroupBy("sport")}
          className={`rounded-[3px] px-2 py-1 text-xs ${groupBy === "sport" ? "bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "bg-[#1d1d26] text-[#f0f0f0]"}`}
        >
          Group: Sport
        </button>
        <button
          type="button"
          onClick={() => setGroupBy("position")}
          className={`rounded-[3px] px-2 py-1 text-xs ${groupBy === "position" ? "bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "bg-[#1d1d26] text-[#f0f0f0]"}`}
        >
          Group: Position
        </button>
      </div>

      <div className="max-h-155 space-y-4 overflow-y-auto pr-1">
        {Object.keys(groupedPlayers).length === 0 ? (
          <p className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 text-sm text-[#555560]">
            No players found.
          </p>
        ) : (
          Object.entries(groupedPlayers).map(([group, groupPlayers]) => (
            <section key={group} className="space-y-2">
              <p className="text-xs font-600 uppercase tracking-wide text-[#555560]">
                {group}
              </p>
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
