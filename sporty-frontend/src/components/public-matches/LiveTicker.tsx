import Link from "next/link";

import type { TMatch } from "@/types/match";
import { teamIdentity } from "@/lib/teamIdentity";

function TickerItem({ match }: { match: TMatch }) {
  const home = teamIdentity(match.home_team);
  const away = teamIdentity(match.away_team);
  return (
    <Link
      href={`/fixtures/${match.id}`}
      className="flex shrink-0 items-center gap-3 border-r border-[rgba(255,255,255,0.08)] px-5 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:no-underline"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-[#ff3b5c] animate-live-pulse" />
      <span
        className="font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px]"
        style={{ color: home.color }}
      >
        {home.initials}
      </span>
      <span className="font-bebas text-sm tabular-nums tracking-[1px] text-[#f0f0f0]">
        {match.home_score ?? 0}&ndash;{match.away_score ?? 0}
      </span>
      <span
        className="font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px]"
        style={{ color: away.color }}
      >
        {away.initials}
      </span>
      <span className="ml-1 truncate text-[10px] uppercase tracking-[1px] text-[#555560]">
        {match.competition}
      </span>
    </Link>
  );
}

export function LiveTicker({ matches }: { matches: TMatch[] }) {
  if (matches.length === 0) {
    return null;
  }
  // Duplicate the list so the marquee loop is seamless at the -50% mark.
  const loop = [...matches, ...matches];

  return (
    <div className="overflow-hidden rounded-[3px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.05)]">
      <div className="marquee-track flex w-max items-center">
        {loop.map((m, i) => (
          <TickerItem key={`${m.id}-${i}`} match={m} />
        ))}
      </div>
    </div>
  );
}
