import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui";
import { sportGlyph } from "@/components/landing/sport-icons";
import type { TMatch } from "@/types/match";
import type { MatchGroup } from "./matchFormat";
import { isToday, kickoffTime, shortDate, statusMeta } from "./matchFormat";
import { TeamBadge } from "./TeamBadge";

function TeamRow({
  name,
  logoUrl,
  score,
}: {
  name: string;
  logoUrl?: string | null;
  score: number | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge name={name} logoUrl={logoUrl} size="sm" />
      <span className="min-w-0 flex-1 truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
        {name}
      </span>
      {score != null && (
        <span className="shrink-0 font-display text-lg leading-none tracking-[-0.02em] tabular-nums text-fg-1">
          {score}
        </span>
      )}
    </div>
  );
}

export function MatchRow({
  match,
  basePath,
  showCompetition = false,
}: {
  match: TMatch;
  basePath: string;
  /** Live section mixes competitions, so each row names its own. */
  showCompetition?: boolean;
}) {
  const { isLive, isFinished } = statusMeta(match.status);
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <Link
      href={`${basePath}/${match.id}`}
      className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/3 hover:no-underline ${
        isLive ? "bg-danger/4" : ""
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 font-sans text-[10px] font-700 uppercase tracking-[1px] text-danger">
            <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
            Live
          </span>
        ) : isFinished ? (
          <span className="font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
            FT
          </span>
        ) : (
          <div className="leading-tight">
            <span className="block font-display text-base leading-none tracking-[-0.02em] text-fg-2">
              {kickoffTime(match.match_date)}
            </span>
            {!isToday(match.match_date) && (
              <span className="mt-0.5 block text-[9px] uppercase tracking-[1px] text-fg-3">
                {shortDate(match.match_date)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamRow
          name={match.home_team}
          logoUrl={match.home_team_logo_url}
          score={hasScore ? match.home_score : null}
        />
        <TeamRow
          name={match.away_team}
          logoUrl={match.away_team_logo_url}
          score={hasScore ? match.away_score : null}
        />
      </div>

      {showCompetition && (
        <span className="hidden max-w-28 shrink-0 truncate text-right text-[9px] uppercase tracking-[1px] text-fg-3 sm:block">
          {match.competition}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-colors group-hover:text-accent" />
    </Link>
  );
}

// Full-width, collapsible competition section (native <details> — open by
// default). Replaces the old fixed-height card with an inner scrollbar.
export function CompetitionPanel({
  group,
  basePath,
  style,
}: {
  group: MatchGroup;
  basePath: string;
  style?: React.CSSProperties;
}) {
  const glyph = sportGlyph(group.sport);
  const Glyph = glyph.Icon;
  return (
    <details open className="group/panel pop-in overflow-hidden card-surface" style={style}>
      <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[3px]"
            style={{ color: glyph.color, background: `${glyph.color}1a` }}
          >
            <Glyph className="size-3.5" />
          </span>
          <span className="truncate font-sans text-xs font-700 uppercase tracking-[2px] text-fg-1">
            {group.competition}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {group.live > 0 ? (
            <Badge tone="danger" size="sm" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              {group.live} Live
            </Badge>
          ) : (
            <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              {group.matches.length}
            </span>
          )}
          <ChevronDown className="size-4 text-fg-3 transition-transform group-open/panel:rotate-180" />
        </div>
      </summary>
      <div className="divide-y divide-white/5 border-t border-white/7">
        {group.matches.map((m) => (
          <MatchRow key={m.id} match={m} basePath={basePath} />
        ))}
      </div>
    </details>
  );
}
