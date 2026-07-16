import Link from "next/link";
import { ChevronRight } from "lucide-react";

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

function MatchRow({ match, basePath }: { match: TMatch; basePath: string }) {
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

      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-colors group-hover:text-accent" />
    </Link>
  );
}

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
    <section
      className="pop-in overflow-hidden card-surface"
      style={style}
    >
      <div aria-hidden className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${glyph.color}, transparent 80%)` }} />
      <header className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3">
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
        {group.live > 0 ? (
          <Badge tone="danger" size="sm" className="shrink-0 gap-1.5">
            <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
            {group.live} Live
          </Badge>
        ) : (
          <span className="shrink-0 font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
            {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </header>
      <div className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
        {group.matches.map((m) => (
          <MatchRow key={m.id} match={m} basePath={basePath} />
        ))}
      </div>
    </section>
  );
}
