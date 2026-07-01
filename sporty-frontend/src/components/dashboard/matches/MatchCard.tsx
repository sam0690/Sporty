"use client";

import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Target } from "lucide-react";
import {
  FootballGlyph,
  BasketballGlyph,
  CricketGlyph,
} from "@/components/landing/sport-icons";

import type { TMatch } from "@/types/match";

type SportConfig = {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  accent: string;
  badge: string;
};

const SPORT_CONFIG: Record<string, SportConfig> = {
  football: { Icon: FootballGlyph, label: "Football", accent: "#16A34A", badge: "sport-badge-football" },
  basketball: { Icon: BasketballGlyph, label: "Basketball", accent: "#EA580C", badge: "sport-badge-basketball" },
  cricket: { Icon: CricketGlyph, label: "Cricket", accent: "#0891B2", badge: "sport-badge-cricket" },
};

const FALLBACK_SPORT: SportConfig = {
  Icon: Target,
  label: "Match",
  accent: "#DC2626",
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
  const SportIcon = sport.Icon;
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
      className="group flex cursor-pointer items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md animate-fade-soft"
    >
      {/* Time / status rail */}
      <div className="w-16 shrink-0 text-center">
        {isLive ? (
          <span className="pill-live justify-center">Live</span>
        ) : isFinished ? (
          <span className="font-condensed text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            FT
          </span>
        ) : (
          <span className="stat-num num text-lg text-ink-muted">
            {kickoffTime(match.match_date)}
          </span>
        )}
      </div>

      {/* Teams + scores */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-condensed text-sm font-bold uppercase tracking-[0.03em] text-ink">
            {match.home_team}
          </span>
          {hasScore && (
            <span className="stat-num num shrink-0 text-lg text-ink">
              {match.home_score}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="truncate font-condensed text-sm font-bold uppercase tracking-[0.03em] text-ink">
            {match.away_team}
          </span>
          {hasScore && (
            <span className="stat-num num shrink-0 text-lg text-ink">
              {match.away_score}
            </span>
          )}
        </div>
      </div>

      {/* Sport + chevron */}
      <div className="flex shrink-0 items-center gap-3">
        <span aria-hidden style={{ color: sport.accent }}>
          <SportIcon className="h-4 w-4" />
        </span>
        <ChevronRight className="h-4 w-4 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </article>
  );
}
