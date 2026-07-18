"use client";

import { useState } from "react";
import Image from "next/image";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { LineupPlayer } from "@/types/events";
import { Panel } from "./Panel";
import { ListIcon } from "./icons";

function PlayerRow({
  player,
  color,
  isRight,
  dimmed = false,
}: {
  player: LineupPlayer;
  color: string;
  isRight: boolean;
  dimmed?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 rounded-[3px] px-1.5 py-1.5 transition-colors hover:bg-white/4 ${
        isRight ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span
        className="grid h-6 min-w-8 shrink-0 place-items-center rounded-[3px] px-1 font-sans text-[10px] font-700 uppercase tracking-[0.5px]"
        style={{
          color,
          background: `${color}${dimmed ? "0d" : "17"}`,
          border: `1px solid ${color}${dimmed ? "26" : "33"}`,
        }}
      >
        {player.position ?? "—"}
      </span>
      <span
        className={`truncate text-sm ${dimmed ? "text-fg-2" : "text-fg-1"}`}
      >
        {player.name ?? "Unknown"}
      </span>
    </li>
  );
}

function TeamColumn({
  teamName,
  logoUrl,
  players,
  bench,
  align,
}: {
  teamName: string;
  logoUrl?: string | null;
  players: LineupPlayer[];
  bench: LineupPlayer[];
  align: "left" | "right";
}) {
  const { color, initials } = teamIdentity(teamName);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;
  const isRight = align === "right";
  return (
    <div>
      <div
        className={`flex items-center gap-2.5 ${isRight ? "flex-row-reverse text-right" : ""}`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[3px] font-display text-sm leading-none tracking-[-0.02em]"
          style={{
            color,
            background: `${color}14`,
            border: `1px solid ${color}40`,
          }}
        >
          {showImage ? (
            <Image
              src={logoUrl as string}
              alt={teamName}
              width={32}
              height={32}
              className="h-full w-full object-contain p-1"
              onError={() => setFailed(true)}
            />
          ) : (
            initials
          )}
        </span>
        <div className={`min-w-0 ${isRight ? "text-right" : ""}`}>
          <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
            {teamName}
          </p>
          <p className="section-label mt-0.5">
            {bench.length > 0
              ? `${players.length} starters · ${bench.length} bench`
              : `${players.length} players`}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-0.5">
        {players.map((p) => (
          <PlayerRow key={p.player_id} player={p} color={color} isRight={isRight} />
        ))}
      </ul>

      {bench.length > 0 && (
        <>
          <div
            className={`mt-4 flex items-center gap-2.5 ${isRight ? "flex-row-reverse" : ""}`}
          >
            <span className="font-sans text-[10px] font-700 uppercase tracking-[2px] text-fg-3">
              Bench
            </span>
            <span aria-hidden className="h-px flex-1 bg-white/8" />
          </div>
          <ul className="mt-2 space-y-0.5">
            {bench.map((p) => (
              <PlayerRow
                key={p.player_id}
                player={p}
                color={color}
                isRight={isRight}
                dimmed
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function LineupsCard() {
  const startingLineups = useMatchStore((s) => s.startingLineups);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const homeTeamLogoUrl = useMatchStore((s) => s.homeTeamLogoUrl);
  const awayTeamLogoUrl = useMatchStore((s) => s.awayTeamLogoUrl);

  const { home, away } = startingLineups;
  if (home.length === 0 && away.length === 0) {
    return null;
  }

  return (
    <Panel title="Lineups" icon={<ListIcon className="size-3.5" />}>
      <div className="relative grid grid-cols-2 gap-5">
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(255,255,255,0.1) 15%, rgba(255,255,255,0.1) 85%, transparent)",
          }}
        />
        <TeamColumn
          teamName={homeTeam ?? "Home"}
          logoUrl={homeTeamLogoUrl}
          players={home}
          bench={startingLineups.home_bench ?? []}
          align="left"
        />
        <TeamColumn
          teamName={awayTeam ?? "Away"}
          logoUrl={awayTeamLogoUrl}
          players={away}
          bench={startingLineups.away_bench ?? []}
          align="right"
        />
      </div>
    </Panel>
  );
}
