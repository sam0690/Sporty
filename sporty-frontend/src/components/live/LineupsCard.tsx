"use client";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { LineupPlayer } from "@/types/events";

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
        className={`flex items-center gap-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-[3px] font-bebas text-xs leading-none tracking-[1px]"
          style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
        >
          {initials}
        </span>
        <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
          {teamName}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {players.map((p) => (
          <li
            key={p.player_id}
            className={`flex items-center gap-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
          >
            <span
              className="grid h-6 min-w-9 shrink-0 place-items-center rounded-[3px] px-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[0.5px]"
              style={{ color, background: `${color}1a` }}
            >
              {p.position ?? "—"}
            </span>
            <span className="truncate text-sm text-[#f0f0f0]">
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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <span className="section-label">Lineups</span>
      </header>
      <div className="grid grid-cols-2 gap-5 p-5">
        <TeamColumn teamName={homeTeam ?? "Home"} players={home} align="left" />
        <TeamColumn teamName={awayTeam ?? "Away"} players={away} align="right" />
      </div>
    </section>
  );
}
