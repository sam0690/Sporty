import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { TMatch } from "@/types/match";
import { teamIdentity } from "@/lib/teamIdentity";
import { sportGlyph } from "@/components/landing/sport-icons";
import { TeamBadge } from "./TeamBadge";
import { isToday, kickoffTime, shortDate, statusMeta } from "./matchFormat";

export function FeaturedMatch({ match }: { match: TMatch }) {
  const { isLive, isFinished } = statusMeta(match.status);
  const home = teamIdentity(match.home_team);
  const away = teamIdentity(match.away_team);
  const glyph = sportGlyph(match.sport);
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <Link
      href={`/fixtures/${match.id}`}
      className="group relative block overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] transition-colors duration-150 hover:border-[rgba(255,255,255,0.18)] hover:no-underline"
    >
      <div
        aria-hidden
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${home.color}, ${home.color} 42%, ${away.color} 58%, ${away.color})`,
        }}
      />

      <div className="relative flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] px-5 py-3 sm:px-8">
        <span className="inline-flex items-center gap-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5]">
          <span style={{ color: glyph.color }}>
            <glyph.Icon className="size-3.5" />
          </span>
          {match.competition}
        </span>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-[rgba(255,59,92,0.32)] bg-[rgba(255,59,92,0.1)] px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#ff3b5c]">
            <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
            Live
          </span>
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
          <p className="truncate text-right font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-2xl">
            {match.home_team}
          </p>
          <TeamBadge name={match.home_team} logoUrl={match.home_team_logo_url} size="lg" />
        </div>

        <div className="shrink-0 text-center">
          {hasScore ? (
            <div className="flex items-center justify-center font-bebas text-4xl leading-none tracking-[2px] sm:text-6xl">
              <span style={{ color: home.color }} className="min-w-[1.1ch] text-right tabular-nums">
                {match.home_score}
              </span>
              <span className="px-1.5 text-[#3a3a42] sm:px-3">:</span>
              <span style={{ color: away.color }} className="min-w-[1.1ch] text-left tabular-nums">
                {match.away_score}
              </span>
            </div>
          ) : (
            <p className="font-bebas text-2xl tracking-[1px] text-[#555560] sm:text-3xl">VS</p>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
          <TeamBadge name={match.away_team} logoUrl={match.away_team_logo_url} size="lg" />
          <p className="truncate font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-2xl">
            {match.away_team}
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-1.5 border-t border-[rgba(255,255,255,0.08)] px-5 py-3 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors group-hover:text-[#e8fb25]">
        View live coverage
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
