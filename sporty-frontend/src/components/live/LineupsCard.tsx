"use client";

import { useState } from "react";
import Image from "next/image";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { LineupPlayer } from "@/types/events";
import { Panel } from "./Panel";
import { ListIcon } from "./icons";

function TeamColumn({
  teamName,
  logoUrl,
  players,
  align,
}: {
  teamName: string;
  logoUrl?: string | null;
  players: LineupPlayer[];
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
          <p className="section-label mt-0.5">{players.length} players</p>
        </div>
      </div>

      <ul className="mt-4 space-y-0.5">
        {players.map((p) => (
          <li
            key={p.player_id}
            className={`flex items-center gap-2.5 rounded-[3px] px-1.5 py-1.5 transition-colors hover:bg-white/4 ${
              isRight ? "flex-row-reverse text-right" : ""
            }`}
          >
            <span
              className="grid h-6 min-w-8 shrink-0 place-items-center rounded-[3px] px-1 font-sans text-[10px] font-700 uppercase tracking-[0.5px]"
              style={{
                color,
                background: `${color}17`,
                border: `1px solid ${color}33`,
              }}
            >
              {p.position ?? "—"}
            </span>
            <span className="truncate text-sm text-fg-1">
              {p.name ?? "Unknown"}
            </span>
          </li>
        ))}
      </ul>
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
          align="left"
        />
        <TeamColumn
          teamName={awayTeam ?? "Away"}
          logoUrl={awayTeamLogoUrl}
          players={away}
          align="right"
        />
      </div>
    </Panel>
  );
}
