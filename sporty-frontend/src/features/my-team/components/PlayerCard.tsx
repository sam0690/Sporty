"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { profileSlug } from "@/utils/profileSlug";
import { ScoreEventList } from "@/components/shared/scoring";
import type { TScoreEvent } from "@/types/player";
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
  gameweekBreakdown?: TScoreEvent[] | null;
  teamName?: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

// Captain wears the armband and doubles their score; vice is the fallback.
function Armband({ letter, active }: { letter: "C" | "V"; active: boolean }) {
  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-800 leading-none ${
        active
          ? "bg-accent text-surface-0"
          : "border border-white/15 text-fg-2"
      }`}
      title={active ? "Captain" : "Vice-captain"}
      aria-label={active ? "Captain" : "Vice-captain"}
    >
      {letter}
    </span>
  );
}

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
  gameweekBreakdown,
  isCaptain,
  isViceCaptain,
}: PlayerCardProps) {
  const meta = SPORT_META[sport];
  const Icon = meta.Icon;
  const [open, setOpen] = useState(false);
  const hasBreakdown = !!gameweekBreakdown && gameweekBreakdown.length > 0;

  return (
    <article className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 card-surface px-4 py-3 transition-colors hover:border-white/16">
      <Link
        href={`/players/${profileSlug(name, id)}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[3px] text-left hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
      >
        <PlayerAvatar name={name} photoUrl={photoUrl} size="md" className="shrink-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-sans text-base font-700 uppercase tracking-[1px] text-fg-1">
              {name}
            </p>
            {isCaptain ? (
              <Armband letter="C" active />
            ) : isViceCaptain ? (
              <Armband letter="V" active={false} />
            ) : null}
            <span className="shrink-0 font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-3">
              {position}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-fg-3">
            <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
              <Icon className="size-3 shrink-0" />
              {meta.label}
            </span>
            {realTeam ? (
              <span className="flex items-center gap-1.5 border-l border-white/10 pl-1.5">
                <TeamLogo teamName={realTeam} logoUrl={realTeamLogoUrl} size="sm" />
                {realTeam}
              </span>
            ) : null}
            {cost ? (
              <>
                <span className="text-white/20">·</span>
                <span className="num">£{cost}M</span>
              </>
            ) : null}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div>
          <p className="num font-display text-2xl leading-none tracking-[-0.02em] text-accent">
            {Math.round(totalPoints)}
          </p>
          <p className="section-label mt-1">Points</p>
        </div>
        {hasBreakdown ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Hide gameweek breakdown" : "Show gameweek breakdown"}
            className="group flex items-center gap-1 rounded-[3px] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span>
              <span className="num block font-display text-lg leading-none tracking-[-0.02em] text-fg-1">
                {gameweekPoints > 0 ? `+${Math.round(gameweekPoints)}` : Math.round(gameweekPoints)}
              </span>
              <span className="section-label mt-1 block">GW</span>
            </span>
            <ChevronDown
              className={`size-4 text-fg-3 transition-transform duration-200 group-hover:text-accent ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        ) : (
          <div>
            <p className="num font-display text-lg leading-none tracking-[-0.02em] text-fg-1">
              {gameweekPoints > 0 ? `+${Math.round(gameweekPoints)}` : Math.round(gameweekPoints)}
            </p>
            <p className="section-label mt-1">GW</p>
          </div>
        )}
        <div>
          <p className="num font-display text-lg leading-none tracking-[-0.02em] text-fg-1">
            {avgPoints.toFixed(1)}
          </p>
          <p className="section-label mt-1">Avg</p>
        </div>
      </div>

      {open && hasBreakdown && (
        <div className="w-full border-t border-white/6 pt-3">
          <ScoreEventList events={gameweekBreakdown} compact />
        </div>
      )}
    </article>
  );
}

export type { PlayerCardProps, Sport };
