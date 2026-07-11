"use client";

import Link from "next/link";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import {
  BasketballGlyph,
  CricketGlyph,
  FootballGlyph,
} from "@/components/landing/sport-icons";

type Sport = "football" | "basketball" | "cricket";

type PlayerCardProps = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  realTeam?: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  cost?: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
  teamName?: string;
};

const SPORT_META: Record<Sport, { Icon: typeof FootballGlyph; color: string; label: string }> = {
  football: { Icon: FootballGlyph, color: "#00ff88", label: "Football" },
  basketball: { Icon: BasketballGlyph, color: "#ff6b35", label: "Basketball" },
  cricket: { Icon: CricketGlyph, color: "#00d4ff", label: "Cricket" },
};

export function PlayerCard({
  id,
  name,
  sport,
  position,
  realTeam,
  photoUrl,
  realTeamLogoUrl,
  cost,
  totalPoints,
  avgPoints,
  gameweekPoints,
}: PlayerCardProps) {
  const meta = SPORT_META[sport];
  const Icon = meta.Icon;

  return (
    <article className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 card-surface px-4 py-3 transition-colors hover:border-white/16">
      <Link
        href={`/players/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[3px] text-left hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
      >
        <PlayerAvatar name={name} photoUrl={photoUrl} size="md" className="shrink-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-fg-1">
              {name}
            </p>
            <span className="shrink-0 font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px] text-fg-3">
              {position}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-fg-3">
            <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
              <Icon className="size-3 shrink-0" />
              {meta.label}
            </span>
            {realTeam ? (
              <span className="flex items-center gap-1.5 border-l border-[#26262e] pl-1.5">
                <TeamLogo teamName={realTeam} logoUrl={realTeamLogoUrl} size="sm" />
                {realTeam}
              </span>
            ) : null}
            {cost ? (
              <>
                <span className="text-white/20">·</span>
                <span className="num">${cost}M</span>
              </>
            ) : null}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div>
          <p className="num font-bebas text-2xl leading-none tracking-[1px] text-accent">
            {Math.round(totalPoints)}
          </p>
          <p className="section-label mt-1">Points</p>
        </div>
        <div>
          <p className="num font-bebas text-lg leading-none tracking-[1px] text-fg-1">
            {gameweekPoints > 0 ? `+${Math.round(gameweekPoints)}` : Math.round(gameweekPoints)}
          </p>
          <p className="section-label mt-1">GW</p>
        </div>
        <div>
          <p className="num font-bebas text-lg leading-none tracking-[1px] text-fg-1">
            {avgPoints.toFixed(1)}
          </p>
          <p className="section-label mt-1">Avg</p>
        </div>
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };
