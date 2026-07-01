"use client";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { LineupPlayer } from "@/types/events";
import { Panel } from "./Panel";
import { ListIcon } from "./icons";

function TeamColumn({
  teamName,
  players,
  align,
}: {
  teamName: string;
  players: LineupPlayer[];
  align: "left" | "right";
}) {
  const { color, initials } = teamIdentity(teamName);
  const isRight = align === "right";
  return (
    <div>
      <div
        className={`flex items-center gap-2.5 ${isRight ? "flex-row-reverse text-right" : ""}`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[7px] font-bebas text-sm leading-none tracking-[1px]"
          style={{
            color,
            background: `linear-gradient(160deg, ${color}2e, ${color}0d)`,
            border: `1px solid ${color}59`,
          }}
        >
          {initials}
        </span>
        <div className={`min-w-0 ${isRight ? "text-right" : ""}`}>
          <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {teamName}
          </p>
          <p className="section-label mt-0.5">{players.length} players</p>
        </div>
      </div>

      <ul className="mt-4 space-y-0.5">
        {players.map((p) => (
          <li
            key={p.player_id}
            className={`flex items-center gap-2.5 rounded-[6px] px-1.5 py-1.5 transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
              isRight ? "flex-row-reverse text-right" : ""
            }`}
          >
            <span
              className="grid h-6 min-w-8 shrink-0 place-items-center rounded-[5px] px-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[0.5px]"
              style={{
                color,
                background: `${color}17`,
                border: `1px solid ${color}33`,
              }}
            >
              {p.position ?? "—"}
            </span>
            <span className="truncate text-sm text-[#d7d7de]">
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

  const { home, away } = startingLineups;
  if (home.length === 0 && away.length === 0) {
    return null;
  }

  return (
    <Panel title="Lineups" icon={<ListIcon className="size-3.5" />}>
      <div className="relative grid grid-cols-2 gap-5">
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[rgba(255,255,255,0.06)]"
        />
        <TeamColumn teamName={homeTeam ?? "Home"} players={home} align="left" />
        <TeamColumn teamName={awayTeam ?? "Away"} players={away} align="right" />
      </div>
    </Panel>
  );
}
