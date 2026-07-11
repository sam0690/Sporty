import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui";
import type { TMatch } from "@/types/match";
import { teamIdentity } from "@/lib/teamIdentity";
import { sportGlyph } from "@/components/landing/sport-icons";
import { TeamBadge } from "./TeamBadge";
import { isToday, kickoffTime, shortDate, statusMeta } from "./matchFormat";

export function FeaturedMatch({
  match,
  basePath,
}: {
  match: TMatch;
  basePath: string;
}) {
  const { isLive, isFinished } = statusMeta(match.status);
  const home = teamIdentity(match.home_team);
  const away = teamIdentity(match.away_team);
  const glyph = sportGlyph(match.sport);
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <Link
      href={`${basePath}/${match.id}`}
      className="group relative block overflow-hidden card-surface transition-colors duration-150 hover:border-white/18 hover:no-underline"
    >
      <div
        aria-hidden
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${home.color}, ${home.color} 42%, ${away.color} 58%, ${away.color})`,
        }}
      />

      <div className="relative flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3 sm:px-8">
        <span className="inline-flex items-center gap-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2">
          <span style={{ color: glyph.color }}>
            <glyph.Icon className="size-3.5" />
          </span>
          {match.competition}
        </span>
        {isLive ? (
          <Badge tone="danger" className="gap-1.5 text-[10px] tracking-[2px]">
            <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
            Live
          </Badge>
        ) : (
          <span className="section-label">
            {isFinished
              ? "Full time"
              : isToday(match.match_date)
                ? `Kicks off ${kickoffTime(match.match_date)}`
                : `${shortDate(match.match_date)} · ${kickoffTime(match.match_date)}`}
          </span>
        )}
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-7 sm:gap-8 sm:px-10 sm:py-10">
        <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
          <p className="truncate text-right font-sans text-lg font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-2xl">
            {match.home_team}
          </p>
          <TeamBadge name={match.home_team} logoUrl={match.home_team_logo_url} size="lg" />
        </div>

        <div className="shrink-0 text-center">
          {hasScore ? (
            <div className="flex items-center justify-center font-display text-4xl leading-none tracking-[-0.02em] sm:text-6xl">
              <span style={{ color: home.color }} className="min-w-[1.1ch] text-right tabular-nums">
                {match.home_score}
              </span>
              <span className="px-1.5 text-white/20 sm:px-3">:</span>
              <span style={{ color: away.color }} className="min-w-[1.1ch] text-left tabular-nums">
                {match.away_score}
              </span>
            </div>
          ) : (
            <p className="font-display text-2xl tracking-[-0.02em] text-fg-3 sm:text-3xl">VS</p>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
          <TeamBadge name={match.away_team} logoUrl={match.away_team_logo_url} size="lg" />
          <p className="truncate font-sans text-lg font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-2xl">
            {match.away_team}
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-1.5 border-t border-white/8 px-5 py-3 font-sans text-[11px] font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors group-hover:text-accent">
        View live coverage
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
