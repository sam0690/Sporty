"use client";

import { useRouter } from "next/navigation";

import { TeamLogo } from "@/components/ui";
import type { TMatch } from "@/types/match";
import {
  BasketballIcon,
  CricketIcon,
  FootballIcon,
  TrophyIcon,
  type EventVisual,
} from "@/components/live/icons";

type SportConfig = {
  Icon: EventVisual["Icon"];
  label: string;
  accent: string;
  badge: string;
};

const SPORT_CONFIG: Record<string, SportConfig> = {
  football: { Icon: FootballIcon, label: "Football", accent: "#00e07f", badge: "sport-badge-football" },
  basketball: { Icon: BasketballIcon, label: "Basketball", accent: "#ff6b35", badge: "sport-badge-basketball" },
  cricket: { Icon: CricketIcon, label: "Cricket", accent: "#00d4ff", badge: "sport-badge-cricket" },
};

const FALLBACK_SPORT: SportConfig = {
  Icon: TrophyIcon,
  label: "Match",
  accent: "#e2c368",
  badge: "sport-badge-multisport",
};

export function sportConfig(sport: string): SportConfig {
  return SPORT_CONFIG[sport?.toLowerCase()] ?? FALLBACK_SPORT;
}

function kickoffTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MatchCard({
  match,
  animationDelay = 0,
}: {
  match: TMatch;
  animationDelay?: number;
}) {
  const router = useRouter();
  const status = (match.status ?? "").toLowerCase();
  const sport = sportConfig(match.sport);
  const hasScore = match.home_score !== null && match.away_score !== null;
  const isLive = status === "live";
  const isFinished = status === "finished";

  const open = () => router.push(`/matches/${match.id}`);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      style={{ animationDelay: `${animationDelay}ms`, borderLeft: `3px solid ${sport.accent}` }}
      className="group flex cursor-pointer items-center gap-4 card-surface px-4 py-3 transition-colors hover:border-white/18 animate-fade-soft"
    >
      {/* Time / status rail */}
      <div className="w-16 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex flex-col items-center gap-0.5">
            <span className="inline-flex items-center gap-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-danger">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              Live
            </span>
          </span>
        ) : isFinished ? (
          <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
            FT
          </span>
        ) : (
          <span className="font-bebas text-lg leading-none tracking-[1px] text-fg-2">
            {kickoffTime(match.match_date)}
          </span>
        )}
      </div>

      {/* Teams + scores */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <TeamLogo teamName={match.home_team} logoUrl={match.home_team_logo_url} size="sm" />
            <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
              {match.home_team}
            </span>
          </span>
          {hasScore && (
            <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-accent">
              {match.home_score}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <TeamLogo teamName={match.away_team} logoUrl={match.away_team_logo_url} size="sm" />
            <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
              {match.away_team}
            </span>
          </span>
          {hasScore && (
            <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-accent">
              {match.away_score}
            </span>
          )}
        </div>
      </div>

      {/* Sport + chevron */}
      <div className="flex shrink-0 items-center gap-3">
        <span aria-hidden style={{ color: sport.accent }}>
          <sport.Icon className="size-4" />
        </span>
        <span className="section-label text-fg-3 transition-colors group-hover:text-accent">
          ›
        </span>
      </div>
    </article>
  );
}
