import Link from "next/link";

import { sportGlyph } from "@/components/landing/sport-icons";
import type { TMatch } from "@/types/match";
import type { MatchGroup } from "./matchFormat";
import { isToday, kickoffTime, shortDate, statusMeta } from "./matchFormat";
import { TeamBadge } from "./TeamBadge";

function TeamRow({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge name={name} size="sm" />
      <span className="min-w-0 flex-1 truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
        {name}
      </span>
      {score != null && (
        <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] tabular-nums text-[#f0f0f0]">
          {score}
        </span>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: TMatch }) {
  const { isLive, isFinished } = statusMeta(match.status);
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <Link
      href={`/fixtures/${match.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:no-underline"
      style={isLive ? { borderLeft: "2px solid #ff3b5c", background: "rgba(255,59,92,0.03)" } : undefined}
    >
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#ff3b5c]">
            <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
            Live
          </span>
        ) : isFinished ? (
          <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#777783]">
            FT
          </span>
        ) : (
          <div className="leading-tight">
            <span className="block font-bebas text-base leading-none tracking-[1px] text-[#9a9aa5]">
              {kickoffTime(match.match_date)}
            </span>
            {!isToday(match.match_date) && (
              <span className="mt-0.5 block text-[9px] uppercase tracking-[1px] text-[#555560]">
                {shortDate(match.match_date)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamRow name={match.home_team} score={hasScore ? match.home_score : null} />
        <TeamRow name={match.away_team} score={hasScore ? match.away_score : null} />
      </div>

      <span className="section-label shrink-0 text-[#555560] transition-colors group-hover:text-[#e8fb25]">
        ›
      </span>
    </Link>
  );
}

export function CompetitionPanel({
  group,
  style,
}: {
  group: MatchGroup;
  style?: React.CSSProperties;
}) {
  const glyph = sportGlyph(group.sport);
  const Glyph = glyph.Icon;
  return (
    <section
      className="pop-in overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-26px_rgba(0,0,0,0.9)]"
      style={style}
    >
      <div aria-hidden className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${glyph.color}, transparent 80%)` }} />
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.07)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[6px]"
            style={{ color: glyph.color, background: `${glyph.color}1a` }}
          >
            <Glyph className="size-3.5" />
          </span>
          <span className="truncate font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#d7d7de]">
            {group.competition}
          </span>
        </div>
        {group.live > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(255,59,92,0.3)] bg-[rgba(255,59,92,0.1)] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#ff3b5c]">
            <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
            {group.live} Live
          </span>
        ) : (
          <span className="shrink-0 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#555560]">
            {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </header>
      <div className="divide-y divide-[rgba(255,255,255,0.05)]">
        {group.matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}
