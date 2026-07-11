import Link from "next/link";

import type { TMatch } from "@/types/match";
import { teamIdentity } from "@/lib/teamIdentity";

function TickerItem({ match }: { match: TMatch }) {
  const home = teamIdentity(match.home_team);
  const away = teamIdentity(match.away_team);
  return (
    <Link
      href={`/fixtures/${match.id}`}
      className="flex shrink-0 items-center gap-3 border-r border-white/8 px-5 py-2.5 transition-colors hover:bg-white/3 hover:no-underline"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-danger animate-live-pulse" />
      <span
        className="font-sans text-xs font-700 uppercase tracking-[0.5px]"
        style={{ color: home.color }}
      >
        {home.initials}
      </span>
      <span className="font-display text-sm tabular-nums tracking-[-0.02em] text-fg-1">
        {match.home_score ?? 0}&ndash;{match.away_score ?? 0}
      </span>
      <span
        className="font-sans text-xs font-700 uppercase tracking-[0.5px]"
        style={{ color: away.color }}
      >
        {away.initials}
      </span>
      <span className="ml-1 truncate text-[10px] uppercase tracking-[1px] text-fg-3">
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
    <div className="overflow-hidden rounded-[3px] border border-danger/25 bg-danger/5">
      <div className="marquee-track flex w-max items-center">
        {loop.map((m, i) => (
          <TickerItem key={`${m.id}-${i}`} match={m} />
        ))}
      </div>
    </div>
  );
}
